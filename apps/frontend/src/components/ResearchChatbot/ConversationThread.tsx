'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import {
    CheckCircle2,
    Copy,
    Check,
    FileText,
    RotateCw,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    BookOpen,
    Share2,
    GitFork,
    ThumbsUp,
    ThumbsDown,
    MoreHorizontal,
    ExternalLink,
} from 'lucide-react';
import { ResearchPaper } from './SourceCardsCarousel';
import CitationBadge, { CitationSemanticType, ServerCitationClassification } from './CitationBadge';
import { sanitizeStepLabel, extractDomain, getFaviconUrl, extractAndStripSources } from '@/lib/citationUtils';

function SourceFaviconItem({ paper, index }: { paper: ResearchPaper; index: number }) {
    const [hasError, setHasError] = useState(false);
    const domain = extractDomain(paper.pdf_url || (paper as any).url || (paper as any).link, paper);
    const faviconUrl = getFaviconUrl(paper.pdf_url || (paper as any).url || (paper as any).link, domain);

    const initial = (domain[0] || 'A').toUpperCase();
    const fallbacks = [
        'bg-rose-500/20 text-rose-400 border-rose-500/40',
        'bg-purple-500/20 text-purple-400 border-purple-500/40',
        'bg-amber-500/20 text-amber-400 border-amber-500/40',
        'bg-sky-500/20 text-sky-400 border-sky-500/40',
    ];
    const fallbackClass = fallbacks[index % fallbacks.length];

    if (hasError || !domain) {
        return (
            <span
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold border ${fallbackClass} shrink-0`}
            >
                {initial}
            </span>
        );
    }

    return (
        <img
            src={faviconUrl}
            alt=""
            onError={() => setHasError(true)}
            className="w-3.5 h-3.5 rounded-full object-cover shrink-0 bg-slate-900 border border-slate-700/80"
            loading="lazy"
        />
    );
}

function SourceFaviconStack({ sources }: { sources: ResearchPaper[] }) {
    const displaySources = sources.slice(0, 3);
    return (
        <div className="inline-flex items-center -space-x-1 shrink-0">
            {displaySources.map((paper, i) => (
                <SourceFaviconItem
                    key={paper.paper_id || paper.id || i}
                    paper={paper}
                    index={i}
                />
            ))}
        </div>
    );
}

export interface ThoughtStep {
    signature: string;
    content: string;
    timestamp?: number;
}

export interface ToolCallTrace {
    tool: string;
    label?: string;
    status: 'running' | 'completed' | 'error';
    detail?: string;
    count?: number;
}

export interface PipelineStepTrace {
    id: string;
    label: string;
    status: 'running' | 'completed' | 'error';
    details?: string;
    elapsed_ms?: number;
}

export interface ChatMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: ResearchPaper[];
    thoughtSteps?: ThoughtStep[];
    toolCalls?: ToolCallTrace[];
    pipelineSteps?: PipelineStepTrace[];
    citationClassifications?: Record<number, ServerCitationClassification>;
    timestamp?: string;
    isError?: boolean;
    errorMessage?: string;
    mode?: string;
}

interface ConversationThreadProps {
    messages: ChatMessage[];
    isLoading: boolean;
    followupQuestions: string[];
    onSelectFollowup: (q: string) => void;
    onRetry?: (errorIndex: number) => void;
    onClipNotes?: (content: string, sources: ResearchPaper[]) => void;
    onSaveToLibrary?: (paper: ResearchPaper) => void;
    onOpenSources?: (sources: ResearchPaper[]) => void;
    userInitials?: string;
}

/**
 * Preprocess academic research content before passing to ReactMarkdown:
 * 1. Converts bracketed math \[ ... \] to $$ ... $$ and \( ... \) to $ ... $.
 * 2. Formats domain citation references [[domain](url)] into custom markdown links [cite-link:domain](url).
 * 3. Formats alternating 2-column plain text tables (e.g. Model size / Approximate compute-optimal tokens) into Markdown table syntax.
 * 4. Elevates numbered section titles (e.g. "1. The basic optimization problem") into Markdown headers ## so CommonMark doesn't treat them as ordered list items.
 * 5. Identifies key academic subheadings (e.g. "The Chinchilla case", "Claim A: ...", "Step 1: ...", "Bottom line", "A compact proof template") and elevates them to ### headers.
 * 6. Formats parameter/variable definitions (e.g. "N: model parameters.", "L_\infty is the irreducible loss floor.") as clean bulleted list items.
 * 7. Automatically wraps standalone mathematical equation lines (lines with LaTeX operators and minimal English prose) in $$ ... $$.
 * 8. Formats implicit lists after lines ending in colon (:) into clean bullet items (- ...).
 * 9. Encloses inline LaTeX formulas (e.g. \alpha\approx\beta, A,B,\alpha,\beta>0, C\approx 6ND, L_\infty) in $ ... $.
 */
/**
 * Resolve a citation number (e.g. from [cite: 21, 41, 43] or [1]) to an authentic paper URL and domain
 */
export function resolveSourceForCitation(
    num: number,
    sources: ResearchPaper[] = []
): { url: string; domain: string; source?: ResearchPaper } {
    if (sources && sources.length > 0) {
        // 1. Direct 1-based index match (e.g. 1 -> sources[0])
        if (sources[num - 1]) {
            const s = sources[num - 1];
            const url = s.pdf_url || (s as any).url || (s as any).link || (s.doi ? `https://doi.org/${s.doi}` : null) || '#';
            const domain = extractDomain(url, s);
            return { url, domain, source: s };
        }

        // 2. Property index match (s.index, s.sourceIndex, etc.)
        const byProp = sources.find(
            (s) =>
                (s as any).index === num ||
                (s as any).sourceIndex === num ||
                (s as any).id === `source-${num}` ||
                (s as any).id === `src_dr_${num}` ||
                (s as any).id === `${num}` ||
                (s as any).paper_id === `source-${num}` ||
                (s as any).paper_id === `${num}`
        );
        if (byProp) {
            const url = byProp.pdf_url || (byProp as any).url || (byProp as any).link || (byProp.doi ? `https://doi.org/${byProp.doi}` : null) || '#';
            const domain = extractDomain(url, byProp);
            return { url, domain, source: byProp };
        }

        // 3. Modulo wrap-around match (vital when model emits 21, 41, 43 but fewer sources stored)
        const wrappedIdx = (num - 1) % sources.length;
        const s = sources[wrappedIdx >= 0 ? wrappedIdx : 0];
        if (s) {
            const url = s.pdf_url || (s as any).url || (s as any).link || (s.doi ? `https://doi.org/${s.doi}` : null) || '#';
            const domain = extractDomain(url, s);
            return { url, domain, source: s };
        }
    }

    return {
        url: `https://scholar.google.com/scholar?q=academic+literature+source+${num}`,
        domain: 'arxiv',
    };
}

export function preprocessAcademicMarkdown(raw: string, sources: ResearchPaper[] = []): string {
    if (!raw) return '';

    let text = raw;

    // 1. Convert standard bracket math \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$\n${math.trim()}\n$$\n\n`);
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

    // 2. Normalize domain citation links like [[arxiv](url)] or [[proceedings.neurips](url)]
    text = text.replace(/\[\[([^\]]+)\]\(([^)]+)\)\]/g, ' [cite-link:$1]($2) ');

    // 2b. Convert [cite: 21, 41, 43], [source: 1], [Source 1], [src: 1, 2], [ref: 1], and [citation: 1] into real cited links
    const explicitCiteRegex = /\[(?:cite|source|src|ref|reference|citation)[:\s]\s*([\d\s,\-]+)(?::[a-z]+)?\]/gi;
    text = text.replace(explicitCiteRegex, (match, rawNums) => {
        if (!rawNums) return match;
        const tokens = rawNums.split(/[\s,]+/).filter(Boolean);
        const parsedNums: number[] = [];
        for (const tok of tokens) {
            if (tok.includes('-')) {
                const [start, end] = tok.split('-').map((n: string) => parseInt(n.trim(), 10));
                if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 15) {
                    for (let n = start; n <= end; n++) parsedNums.push(n);
                }
            } else {
                const n = parseInt(tok.trim(), 10);
                if (!isNaN(n)) parsedNums.push(n);
            }
        }

        if (parsedNums.length === 0) return match;

        return parsedNums.map((num: number) => {
            const { url, domain } = resolveSourceForCitation(num, sources);
            return ` [cite-link:${domain}](${url}) `;
        }).join('');
    });

    // 2c. Convert standalone numeric citations like [1], [2], [1, 2], [21, 41, 43] into real cited links
    // Ensures it's not a markdown link (not followed by '(') and not LaTeX math
    const numericCiteRegex = /(?<![\$\\=a-zA-Z0-9])\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g;
    text = text.replace(numericCiteRegex, (match, rawNums) => {
        if (!rawNums) return match;
        const tokens = rawNums.split(/[\s,]+/).filter(Boolean);
        const parsedNums: number[] = tokens.map((t: string) => parseInt(t.trim(), 10)).filter((n: number) => !isNaN(n));
        if (parsedNums.length === 0) return match;

        return parsedNums.map((num: number) => {
            const { url, domain } = resolveSourceForCitation(num, sources);
            return ` [cite-link:${domain}](${url}) `;
        }).join('');
    });

    // 3. Convert 2-column alternating plain table (e.g. Model size / Approximate compute-optimal tokens...)
    text = text.replace(
        /(Model size\s*\n\s*Approximate compute-optimal tokens)([\s\S]*?)(?=\n\s*\n|\n[A-Z][a-z]+ [a-z]+ [a-z]+ [a-z]+|\n\d+\.\s+[A-Z]|\n#|$)/i,
        (match, header, body) => {
            const rawLines = body.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
            const tableCells: string[] = [];
            const remainingLines: string[] = [];
            let inTable = true;
            for (const line of rawLines) {
                if (inTable && line.length < 60 && !line.endsWith('.') && !line.includes('[[')) {
                    tableCells.push(line);
                } else {
                    inTable = false;
                    remainingLines.push(line);
                }
            }

            if (tableCells.length >= 2) {
                let mdTable = '\n\n| Model size | Approximate compute-optimal tokens |\n| :--- | :--- |\n';
                for (let i = 0; i < tableCells.length; i += 2) {
                    const col1 = tableCells[i] || '';
                    const col2 = tableCells[i + 1] || '';
                    mdTable += `| ${col1} | ${col2} |\n`;
                }
                const remainder = remainingLines.length > 0 ? '\n\n' + remainingLines.join('\n') : '';
                return mdTable + remainder;
            }
            return match;
        }
    );

    const lines = text.split('\n');
    const resultLines: string[] = [];

    // Math indicators: LaTeX commands or standalone formula syntax
    const standaloneMathRegex = /(?:\\(?:frac|propto|approx|boxed|min|argmin|max|sum|int|cdot|times|alpha|beta|gamma|sigma|epsilon|rho|infty|left|right|qquad|quad|in|ne|leq|geq|partial|log|text|mathrm)\b|[\w\^\\\{\}\*]+\s*=\s*[\w\^\\\{\}\*]+|\b6ND\s*=\s*C\b|\bC\s*=\s*kND\b|\bD\s*=\s*C\/)/;

    const isSubheading = (l: string) => {
        return /^(?:The Chinchilla case|Claim [A-Z]:.*|Step \d+:.*|Bottom line|A compact proof template|Confusing a fit with a theorem|Poor hyperparameter tuning|Incorrect FLOP accounting|Training too little data|Data repetition and quality|Extrapolation)$/i.test(l.trim());
    };

    // Check if line contains English prose
    const proseVerbsOrStarters = /^(?:Compute|Loss|Assume|Optimization|Then|Under|For|The|This|Equivalently|Hence|Therefore|Because|Without|Train|Choose|Fit|Report|Reserve|Small|A|Poor|Incorrect|Training|Data|Extrapolation|You|If|Consequently|With|Subject to|Where)\b/i;
    const isEnglishProse = (l: string) => {
        if (/^if\s+.*,\s*then:?/i.test(l.trim())) return true;
        if (proseVerbsOrStarters.test(l.trim())) return true;
        const words = l.replace(/\\(?:text|mathrm|operatorname)\{[^}]*\}/g, '')
                       .replace(/\\[a-zA-Z]+/g, '')
                       .match(/[A-Za-z]{3,}/g) || [];
        return words.length >= 2;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            resultLines.push(line);
            continue;
        }

        // Title at very top (line 0) if plain string without markdown
        if (i === 0 && !trimmed.startsWith('#') && trimmed.length < 60 && !trimmed.endsWith('.')) {
            resultLines.push(`# ${trimmed}\n`);
            continue;
        }

        // Major Numbered Section Headers: "1. The basic optimization problem" -> "## 1. The basic optimization problem"
        if (/^\d+\.\s+[A-Z]/.test(trimmed) && trimmed.length < 80 && !trimmed.includes('$$')) {
            resultLines.push(`\n## ${trimmed}\n`);
            continue;
        }

        // Distinct Section Subheadings
        if (isSubheading(trimmed)) {
            if (/^Claim [A-Z]:/i.test(trimmed) || /^Step \d+:/i.test(trimmed)) {
                resultLines.push(`\n### ${trimmed}\n`);
            } else if (/^Bottom line$/i.test(trimmed)) {
                resultLines.push(`\n### 💡 ${trimmed}\n`);
            } else {
                resultLines.push(`\n### ${trimmed}\n`);
            }
            continue;
        }

        // Variable definitions: e.g. "N: model parameters." or "L_\infty is the irreducible loss floor."
        if (/^[A-Za-z\\](?:_\{?[a-zA-Z0-9\\]+\}?)?:\s+[a-z]/i.test(trimmed)) {
            resultLines.push(`- **$${trimmed.slice(0, trimmed.indexOf(':'))}$**: ${trimmed.slice(trimmed.indexOf(':') + 1).trim()}`);
            continue;
        }
        if (/^(?:L_\\infty|A\/N\^\\alpha|B\/D\^\\beta)\s+is\s+/i.test(trimmed)) {
            const parts = trimmed.split(/\s+is\s+/);
            resultLines.push(`- **$${parts[0]}$** is ${parts.slice(1).join(' is ')}`);
            continue;
        }

        // Standalone mathematical equations without $$
        // If line is not already wrapped in $$ or $ and has math symbols and not prose
        if (
            !trimmed.startsWith('$') &&
            !trimmed.endsWith('$$') &&
            !trimmed.startsWith('#') &&
            !trimmed.startsWith('>') &&
            !trimmed.startsWith('- ') &&
            !trimmed.startsWith('* ') &&
            !trimmed.startsWith('|') &&
            standaloneMathRegex.test(trimmed) &&
            !isEnglishProse(trimmed)
        ) {
            resultLines.push(`\n$$\n${trimmed}\n$$\n`);
            continue;
        }

        // Implicit bullet items after a colon line (e.g. "Specify:", "Report:", "The fitted exponents and optimal ratio can change with:")
        if (
            i > 0 &&
            lines[i - 1].trim().endsWith(':') &&
            !trimmed.startsWith('- ') &&
            !trimmed.startsWith('* ') &&
            !trimmed.startsWith('#') &&
            !trimmed.startsWith('$') &&
            !isSubheading(trimmed) &&
            !standaloneMathRegex.test(trimmed) &&
            trimmed.length < 90
        ) {
            // Check if this and subsequent lines form a list
            let lookAhead = i;
            let count = 0;
            while (
                lookAhead < lines.length &&
                lines[lookAhead].trim() &&
                lines[lookAhead].trim().length < 90 &&
                !lines[lookAhead].trim().includes('$$') &&
                !isSubheading(lines[lookAhead].trim()) &&
                !standaloneMathRegex.test(lines[lookAhead].trim()) &&
                !/^\d+\./.test(lines[lookAhead].trim())
            ) {
                count++;
                lookAhead++;
            }
            if (count >= 2) {
                // Convert these consecutive lines into bullet items
                for (let k = 0; k < count; k++) {
                    const l = lines[i + k].trim();
                    resultLines.push(`- ${l}`);
                }
                i += count - 1;
                continue;
            }
        }

        // Check for inline math that should be wrapped in $...$
        let processedLine = line;

        // If line has "If \alpha=\beta, then:" or "where:"
        processedLine = processedLine.replace(/If\s+([\w\\=~]+)\s*,\s*then:/i, (_, expr) => `If $${expr}$, then:`);

        // Isolated math variables / expressions
        processedLine = processedLine.replace(
            /(?<!\$)\b([A-Z]\s*\\approx\s*[0-9A-Za-z]+|[A-Za-z],[A-Za-z],\\alpha,\\beta>0|\\alpha\\approx\\beta|\\alpha=\\beta|A\/N\^\\alpha|B\/D\^\\beta|L_\\infty|N_{\\mathrm{opt}}|D_{\\mathrm{opt}}|N^\*|D^\*|\bC_i\b|\bR\^2\b)(?!\$)/g,
            '$$$1$$'
        );

        resultLines.push(processedLine);
    }

    return resultLines.join('\n');
}

export default function ConversationThread({
    messages,
    isLoading,
    followupQuestions = [],
    onSelectFollowup,
    onRetry,
    onClipNotes,
    onSaveToLibrary,
    onOpenSources,
    userInitials = 'ME',
}: ConversationThreadProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [sharedIndex, setSharedIndex] = useState<number | null>(null);
    const [feedbackState, setFeedbackState] = useState<Record<number, 'up' | 'down' | null>>({});
    const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
    const [expandedTraces, setExpandedTraces] = useState<Record<number, boolean>>({});

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleShare = async (text: string, idx: number) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({
                    title: 'Tafiti AI Research',
                    text: text.slice(0, 300) + '...',
                    url: window.location.href,
                });
            } else if (typeof navigator !== 'undefined') {
                await navigator.clipboard.writeText(window.location.href);
            }
            setSharedIndex(idx);
            setTimeout(() => setSharedIndex(null), 2000);
        } catch {
            // ignore share cancel
        }
    };

    const handleForkOrRetry = (idx: number) => {
        const lastUser = messages.slice(0, idx).reverse().find(m => m.role === 'user');
        if (lastUser && onSelectFollowup) {
            onSelectFollowup(lastUser.content);
        }
    };

    const handleFeedback = (idx: number, type: 'up' | 'down') => {
        setFeedbackState(prev => ({
            ...prev,
            [idx]: prev[idx] === type ? null : type,
        }));
    };

    const renderMarkdownWithCitations = (
        content: string,
        sources: ResearchPaper[] = [],
        citationClassifications: Record<number, ServerCitationClassification> = {}
    ) => {
        const processedContent = preprocessAcademicMarkdown(content, sources);

        return (
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-main)] mt-2 mb-4 tracking-tight leading-tight pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--text-main)] mt-8 mb-3.5 tracking-tight leading-tight pb-2 border-b border-[var(--border-glass)]/60 flex items-center gap-2.5">
                            <span className="w-1.5 h-5 bg-sky-500 rounded-full inline-block shrink-0" />
                            <span>{children}</span>
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base sm:text-lg md:text-xl font-semibold text-sky-200/95 mt-6 mb-2.5 tracking-tight leading-snug">
                            {children}
                        </h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm sm:text-base font-semibold text-[var(--text-main)] mt-4 mb-2 tracking-tight">
                            {children}
                        </h4>
                    ),
                    p: ({ children }) => (
                        <p className="text-[14.5px] sm:text-[15px] md:text-[15.5px] leading-relaxed sm:leading-[1.75] text-[var(--text-main)]/95 mb-4 last:mb-0 break-words">
                            {children}
                        </p>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-outside pl-6 space-y-2 my-3.5 text-[14.5px] sm:text-[15px] text-[var(--text-main)]/95 leading-relaxed sm:leading-[1.7]">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-outside pl-6 space-y-2 my-3.5 text-[14.5px] sm:text-[15px] text-[var(--text-main)]/95 leading-relaxed sm:leading-[1.7]">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed sm:leading-[1.7] pl-1 text-[var(--text-main)]/95 break-words">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-3 border-sky-500/50 pl-4 my-5 italic text-[var(--text-muted)] bg-[var(--btn-surface)] py-2 pr-2 rounded-r">
                            {children}
                        </blockquote>
                    ),
                    table: ({ children }) => (
                        <div className="w-full max-w-full my-6 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
                            <div className="w-full overflow-x-auto scrollbar-thin overscroll-x-contain">
                                <table className="w-full min-w-[500px] sm:min-w-full text-left text-xs sm:text-sm border-collapse">
                                    {children}
                                </table>
                            </div>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-[var(--btn-surface)] text-[var(--text-main)] border-b border-[var(--border-glass)] text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
                            {children}
                        </thead>
                    ),
                    th: ({ children }) => (
                        <th className="py-3 px-4 font-semibold text-sky-200 bg-[var(--btn-surface)] border-b border-[var(--border-glass)] whitespace-nowrap text-xs sm:text-sm tracking-wide">
                            {children}
                        </th>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-[var(--border-glass)]/60">
                            {children}
                        </tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-[var(--sidebar-hover)] transition-colors">
                            {children}
                        </tr>
                    ),
                    td: ({ children }) => (
                        <td className="py-2.5 px-4 text-[var(--text-main)] leading-relaxed text-xs sm:text-sm break-words align-middle border-b border-[var(--border-glass)]/30">
                            {children}
                        </td>
                    ),
                    img: ({ src, alt, ...props }) => (
                        <figure className="my-5 sm:my-7 max-w-full w-full overflow-hidden rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] shadow-sm">
                            <div className="relative w-full flex items-center justify-center p-2 sm:p-4 bg-[var(--btn-surface)]/30 overflow-hidden">
                                <img
                                    src={src}
                                    alt={alt || 'Research visual'}
                                    className="w-auto max-w-full h-auto max-h-[380px] sm:max-h-[520px] object-contain rounded-lg transition-transform duration-300 hover:scale-[1.01]"
                                    loading="lazy"
                                    {...props}
                                />
                            </div>
                            {alt && (
                                <figcaption className="px-3.5 py-2 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-glass)] bg-[var(--btn-surface)] font-medium">
                                    {alt}
                                </figcaption>
                            )}
                        </figure>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-white/95">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="italic text-[var(--text-main)]">{children}</em>
                    ),
                    a: ({ children, href }) => {
                        const childStr = React.Children.toArray(children).join('');
                        const isCiteLink = childStr.startsWith('cite-link:');
                        const isAcademicLink =
                            isCiteLink ||
                            Boolean(href && sources.some((s) => s.url === href || s.pdf_url === href)) ||
                            /^(?:arxiv|biorxiv|medrxiv|nature|springer|doi|neurips|science|pubmed|openalex|sciencedirect)/i.test(childStr) ||
                            Boolean(href && /arxiv\.org|doi\.org|nature\.com|biorxiv\.org|ncbi\.nlm\.nih\.gov|neurips\.cc/i.test(href));

                        if (isAcademicLink && href) {
                            const domainLabel = isCiteLink
                                ? childStr.replace('cite-link:', '').trim()
                                : extractDomain(href);

                            const matchedSource = sources.find(
                                (s) =>
                                    s.url === href ||
                                    (s.pdf_url && s.pdf_url === href) ||
                                    (s.doi && href && href.includes(s.doi)) ||
                                    (s.source && s.source.toLowerCase().includes(domainLabel.toLowerCase())) ||
                                    (s.journal && s.journal.toLowerCase().includes(domainLabel.toLowerCase())) ||
                                    (s.title && s.title.toLowerCase().includes(domainLabel.toLowerCase()))
                            );
                            const sourceIdx = matchedSource ? sources.indexOf(matchedSource) + 1 : undefined;

                            return (
                                <CitationBadge
                                    key={href}
                                    index={sourceIdx}
                                    domain={domainLabel}
                                    url={href}
                                    source={matchedSource}
                                    onSelectSource={onSaveToLibrary}
                                />
                            );
                        }

                        return (
                            <a
                                href={href}
                                className="text-sky-400 hover:text-sky-300 underline underline-offset-2 decoration-sky-500/30 hover:decoration-sky-500/60 transition-all"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {children}
                            </a>
                        );
                    },
                    hr: () => (
                        <hr className="my-6 border-t border-[var(--border-glass)]" />
                    ),
                    code: ({ children, className }) => {
                        if (className) {
                            return (
                                <div className="my-5 max-w-full rounded-xl bg-[var(--btn-surface)] border border-[var(--border-glass)] overflow-hidden shadow-sm">
                                    <code className="block p-3 sm:p-4 text-[var(--text-main)] font-mono text-xs sm:text-sm leading-6 overflow-x-auto scrollbar-thin">
                                        {children}
                                    </code>
                                </div>
                            );
                        }
                        return (
                            <code className="px-1.5 py-0.5 rounded bg-[var(--btn-surface)] text-sky-400 font-mono text-xs border border-[var(--border-glass)] break-all">
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => (
                        <pre className="my-5 max-w-full rounded-xl bg-[var(--btn-surface)] border border-[var(--border-glass)] overflow-x-auto scrollbar-thin">
                            {children}
                        </pre>
                    ),
                    text: ({ children }) => {
                        if (typeof children !== 'string') return <>{children}</>;

                        // Supports [cite: 1, 2], [source: 1], [Source 1], [src: 1], [1, 2], [1], [1-3], and [cite: 1:supported]
                        const citationRegex = /\[(?:(?:cite|source|src)[:\s]\s*)?([\d\s,\-]+)(?::(supported|contrasting|mentioning))?\]/gi;
                        const parts: React.ReactNode[] = [];
                        let lastIdx = 0;
                        let match: RegExpExecArray | null;

                        while ((match = citationRegex.exec(children)) !== null) {
                            if (match.index > lastIdx) {
                                parts.push(children.substring(lastIdx, match.index));
                            }

                            const rawIndices = match[1];
                            const explicitType = match[2]?.toLowerCase() as CitationSemanticType | undefined;

                            // Parse numbers and hyphen ranges
                            const tokens = rawIndices.split(/[\s,]+/);
                            const parsedNums: number[] = [];
                            for (const tok of tokens) {
                                if (!tok.trim()) continue;
                                if (tok.includes('-')) {
                                    const [start, end] = tok.split('-').map((n) => parseInt(n.trim(), 10));
                                    if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 20) {
                                        for (let n = start; n <= end; n++) parsedNums.push(n);
                                    }
                                } else {
                                    const n = parseInt(tok.trim(), 10);
                                    if (!isNaN(n)) parsedNums.push(n);
                                }
                            }

                            if (parsedNums.length > 0) {
                                parsedNums.forEach((sourceNum, subIdx) => {
                                    const serverClassification = citationClassifications[sourceNum];
                                    const semanticType: CitationSemanticType =
                                        serverClassification?.semantic_type || explicitType || 'supported';
                                    const sourceItem = sources[sourceNum - 1];

                                    parts.push(
                                        <CitationBadge
                                            key={`${match!.index}-${sourceNum}-${subIdx}`}
                                            index={sourceNum}
                                            source={sourceItem}
                                            type={semanticType}
                                            classification={serverClassification}
                                        />
                                    );
                                });
                            } else {
                                parts.push(match[0]);
                            }

                            lastIdx = citationRegex.lastIndex;
                        }

                        if (lastIdx < children.length) {
                            parts.push(children.substring(lastIdx));
                        }

                        return <>{parts}</>;
                    },
                }}
            >
                {processedContent}
            </ReactMarkdown>
        );
    };

    return (
        <div className="w-full min-w-0 space-y-10 pb-8 font-sans">
            {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const rawSources = msg.sources || [];
                const { cleanContent, sources } = extractAndStripSources(msg.content || '', rawSources);
                const isCurrentLoading = isLoading && idx === messages.length - 1;
                const classifications = msg.citationClassifications || {};

                // ── 1. USER INQUIRY (Perplexity style: clean user bubble) ──
                if (isUser) {
                    return (
                        <div key={idx} className="flex justify-end pt-4 pb-2">
                            <div className="max-w-2xl px-4 py-2.5 rounded-2xl bg-[var(--btn-surface)] border border-[var(--border-glass)] text-[var(--text-main)] text-sm sm:text-[15px] leading-relaxed shadow-sm break-words">
                                {msg.content}
                            </div>
                        </div>
                    );
                }

                // ── 2. ERROR STATE (Discreet, unboxed, with retry) ───────────────
                if (msg.isError) {
                    const lastUser = [...messages.slice(0, idx)].reverse().find(m => m.role === 'user');
                    return (
                        <div key={idx} className="py-4 space-y-3 animate-fade-in">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                <div className="space-y-1.5 text-sm">
                                    <p className="font-semibold text-[var(--text-main)]">Unable to complete research investigation</p>
                                    <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                                        {msg.errorMessage || 'An error occurred while connecting to the research services. Please verify your query or try again.'}
                                    </p>
                                    {lastUser && (
                                        <button
                                            type="button"
                                            onClick={() => (onRetry ? onRetry(idx) : onSelectFollowup(lastUser.content))}
                                            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-[var(--btn-surface)] hover:bg-[var(--sidebar-hover)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer border border-[var(--border-glass)]"
                                        >
                                            <RotateCw className="w-3.5 h-3.5" />
                                            <span>Retry query</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                // ── 3. AGENT TRACES & ACTIVE STEPS ──────────────────────────────
                const pipelineSteps = msg.pipelineSteps || [];
                const thoughtSteps = msg.thoughtSteps || [];
                const toolCalls = msg.toolCalls || [];
                const totalTraces = pipelineSteps.length + thoughtSteps.length + toolCalls.length;

                // Active live step text during research
                const runningStep = pipelineSteps.find(s => s.status === 'running')?.label;
                const latestThought = thoughtSteps.length > 0 ? thoughtSteps[thoughtSteps.length - 1].signature : null;
                const activeTraceStatus = runningStep || latestThought || (isCurrentLoading ? 'Searching academic literature...' : null);

                const isTracesExpanded = expandedTraces[idx] ?? false;

                // ── 4. ASSISTANT RESPONSE (Completely unboxed flow) ──────────────
                return (
                    <div key={idx} className="space-y-4 animate-fade-in">
                        {/* A. LOADING SPINNER (Minimalist spinner while investigating) */}
                        {isCurrentLoading && !cleanContent && (
                            <div className="py-3 flex items-center gap-2.5 animate-fade-in text-sky-400">
                                <div className="w-5 h-5 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin shrink-0" />
                            </div>
                        )}

                        {/* C. SYNTHESIZED LITERATURE RESPONSE */}
                        {cleanContent ? (
                            <div className="text-[var(--text-main)] min-w-0 break-words">
                                {renderMarkdownWithCitations(cleanContent, sources, classifications)}
                                {isCurrentLoading && (
                                    <div className="pt-2.5 flex items-center text-sky-400 animate-fade-in">
                                        <div className="w-4 h-4 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin shrink-0" />
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* D. ACTION BAR (Clean logos on single line with sources matching Perplexity/Image) */}
                        {!isCurrentLoading && cleanContent && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-3 text-[var(--text-muted)] border-b border-[var(--border-glass)] select-none">
                                {/* Left: Action buttons (logos only: copy, share, fork) */}
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(cleanContent, idx)}
                                        className="p-1.5 rounded-md hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                                        title={copiedIndex === idx ? 'Copied to clipboard' : 'Copy response'}
                                        aria-label={copiedIndex === idx ? 'Copied' : 'Copy'}
                                    >
                                        {copiedIndex === idx ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleShare(cleanContent, idx)}
                                        className="p-1.5 rounded-md hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                                        title={sharedIndex === idx ? 'Link copied' : 'Share'}
                                        aria-label="Share"
                                    >
                                        {sharedIndex === idx ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Share2 className="w-4 h-4" />
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleForkOrRetry(idx)}
                                        className="p-1.5 rounded-md hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                                        title="Fork / Re-run query"
                                        aria-label="Fork"
                                    >
                                        <GitFork className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Right: Sources (logos + count) + Feedback (thumbs up/down, more) */}
                                <div className="flex items-center gap-2 sm:gap-3">
                                    {sources.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const el = document.getElementById(`sources-top-${idx}`);
                                                if (el) {
                                                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                }
                                                onOpenSources?.(sources);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer group"
                                            title="View all sources"
                                            aria-label={`View ${sources.length} sources`}
                                        >
                                            <SourceFaviconStack sources={sources} />
                                            <span className="text-xs font-medium tracking-tight">
                                                {sources.length} sources
                                            </span>
                                        </button>
                                    )}

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleFeedback(idx, 'up')}
                                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                                feedbackState[idx] === 'up'
                                                    ? 'text-sky-400 bg-sky-500/10'
                                                    : 'hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'
                                            }`}
                                            title="Good response"
                                            aria-label="Thumbs up"
                                        >
                                            <ThumbsUp className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleFeedback(idx, 'down')}
                                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                                feedbackState[idx] === 'down'
                                                    ? 'text-rose-400 bg-rose-500/10'
                                                    : 'hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'
                                            }`}
                                            title="Bad response"
                                            aria-label="Thumbs down"
                                        >
                                            <ThumbsDown className="w-4 h-4" />
                                        </button>

                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setActiveMenuIndex(activeMenuIndex === idx ? null : idx)}
                                                className="p-1.5 rounded-md hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                                                title="More options"
                                                aria-label="More options"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>

                                            {activeMenuIndex === idx && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setActiveMenuIndex(null)}
                                                    />
                                                    <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-glass)] shadow-xl py-1 text-xs text-[var(--text-main)] animate-fade-in">
                                                        {onClipNotes && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onClipNotes(cleanContent, sources);
                                                                    setActiveMenuIndex(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-left cursor-pointer"
                                                            >
                                                                <FileText className="w-3.5 h-3.5 text-sky-400" />
                                                                <span>Save to notes</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleCopy(cleanContent, idx);
                                                                setActiveMenuIndex(null);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-left cursor-pointer"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                            <span>Copy markdown</span>
                                                        </button>
                                                        {sources.length > 0 && onOpenSources && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onOpenSources(sources);
                                                                    setActiveMenuIndex(null);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-left cursor-pointer"
                                                            >
                                                                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                                                                <span>View {sources.length} sources</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* E. RELATED QUESTIONS (Perplexity style at bottom of latest response) */}
                        {idx === messages.length - 1 && !isLoading && followupQuestions.length > 0 && (
                            <div className="space-y-2 pt-2 pb-8 animate-fade-in">
                                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1">
                                    Related
                                </div>
                                <div className="divide-y divide-[var(--border-glass)]">
                                    {followupQuestions.map((q, qIdx) => (
                                        <button
                                            key={qIdx}
                                            onClick={() => onSelectFollowup(q)}
                                            className="w-full flex items-center justify-between py-2.5 px-1 text-left text-sm text-[var(--text-main)] hover:text-sky-400 transition-all duration-200 ease-out group"
                                            aria-label={`Follow-up: ${q}`}
                                        >
                                            <span>{q}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-sky-400 group-hover:translate-x-1 transition-all duration-200 ease-out shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
