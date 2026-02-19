/**
 * CitationExportPanel — Auto-formats a list of PaperBase objects into
 * BibTeX, APA, MLA, Chicago, Vancouver, and RIS citation formats.
 * All processing is done client-side (no API call needed).
 */
import React, { useState } from 'react';
import {
    BookMarked, Copy, Download, CheckCheck, ChevronDown, ChevronUp, X
} from 'lucide-react';

// ── Citation formatters ────────────────────────────────────────────────────────

/**
 * Parse "Firstname Lastname" → { first: "Firstname", last: "Lastname" }
 * Handles "O. Smith", "Smith", "Firstname Middle Lastname", etc.
 */
function parseName(fullName = '') {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first: '', last: parts[0] };
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    return { first, last };
}

/** "Firstname Lastname" → "Lastname, Firstname" */
function reverseAuthor(name) {
    const { first, last } = parseName(name);
    return first ? `${last}, ${first}` : last;
}

/** "Firstname Lastname" → "Lastname, F." */
function abbreviateFirst(name) {
    const { first, last } = parseName(name);
    const initials = first.split(/\s+/).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
    return first ? `${last}, ${initials}` : last;
}

/** Slugify for BibTeX key: "Smith 2021 deep learning" → "smith2021deep" */
function bibtexKey(paper) {
    const lastAuthor = paper.authors[0] ? parseName(paper.authors[0]).last.toLowerCase().replace(/[^a-z]/g, '') : 'unknown';
    const year = paper.year || 'nd';
    const titleWord = (paper.title || '').toLowerCase().split(/\s+/).find(w => w.length > 3 && !/^(the|and|for|with|from|this|that)$/.test(w)) || 'paper';
    return `${lastAuthor}${year}${titleWord.replace(/[^a-z]/g, '')}`;
}

const openAlexUrl = (id) => id.startsWith('http') ? id : `https://openalex.org/${id}`;

// ── Format implementations ────────────────────────────────────────────────────

function formatBibTeX(papers) {
    return papers.map(p => {
        const authors = p.authors.length > 0
            ? p.authors.map(a => reverseAuthor(a)).join(' and ')
            : 'Unknown Author';
        return [
            `@article{${bibtexKey(p)},`,
            `  author    = {${authors}},`,
            `  title     = {{${p.title || 'Untitled'}}},`,
            `  year      = {${p.year || 'n.d.'}},`,
            `  url       = {${openAlexUrl(p.id)}}`,
            `}`,
        ].join('\n');
    }).join('\n\n');
}

function formatAPA(papers) {
    return papers.map((p, i) => {
        const authors = p.authors.length === 0
            ? 'Unknown Author'
            : p.authors.length === 1
                ? abbreviateFirst(p.authors[0])
                : p.authors.slice(0, -1).map(abbreviateFirst).join(', ')
                    + ', & ' + abbreviateFirst(p.authors[p.authors.length - 1]);
        const year = p.year ? `(${p.year})` : '(n.d.)';
        return `[${i + 1}] ${authors} ${year}. ${p.title || 'Untitled'}. OpenAlex. ${openAlexUrl(p.id)}`;
    }).join('\n\n');
}

function formatMLA(papers) {
    return papers.map((p, i) => {
        let authStr;
        if (p.authors.length === 0) authStr = 'Unknown Author';
        else if (p.authors.length === 1) authStr = reverseAuthor(p.authors[0]);
        else authStr = reverseAuthor(p.authors[0]) + ', et al.';
        const year = p.year || 'n.d.';
        return `[${i + 1}] ${authStr}. "${p.title || 'Untitled'}." OpenAlex, ${year}. ${openAlexUrl(p.id)}`;
    }).join('\n\n');
}

function formatChicago(papers) {
    return papers.map((p, i) => {
        let authStr;
        if (p.authors.length === 0) authStr = 'Unknown Author';
        else if (p.authors.length === 1) authStr = reverseAuthor(p.authors[0]);
        else if (p.authors.length === 2)
            authStr = reverseAuthor(p.authors[0]) + ', and ' + p.authors[1];
        else authStr = reverseAuthor(p.authors[0]) + ', et al.';
        const year = p.year || 'n.d.';
        return `[${i + 1}] ${authStr}. "${p.title || 'Untitled'}." OpenAlex, ${year}. ${openAlexUrl(p.id)}.`;
    }).join('\n\n');
}

function formatVancouver(papers) {
    return papers.map((p, i) => {
        const authors = p.authors.length === 0
            ? 'Unknown Author'
            : p.authors.slice(0, 6).map(a => {
                const { first, last } = parseName(a);
                const initials = first.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
                return `${last} ${initials}`;
            }).join(', ') + (p.authors.length > 6 ? ', et al.' : '');
        const year = p.year || 'n.d.';
        return `${i + 1}. ${authors}. ${p.title || 'Untitled'}. OpenAlex. ${year}. Available: ${openAlexUrl(p.id)}`;
    }).join('\n\n');
}

function formatRIS(papers) {
    return papers.map(p => {
        const lines = ['TY  - JOUR'];
        lines.push(`TI  - ${p.title || 'Untitled'}`);
        if (p.authors.length > 0) {
            p.authors.forEach(a => lines.push(`AU  - ${reverseAuthor(a)}`));
        }
        if (p.year) lines.push(`PY  - ${p.year}`);
        lines.push(`UR  - ${openAlexUrl(p.id)}`);
        lines.push('ER  -');
        return lines.join('\n');
    }).join('\n\n');
}

// ── Config map ────────────────────────────────────────────────────────────────

const FORMATS = [
    { id: 'bibtex', label: 'BibTeX', ext: 'bib', fn: formatBibTeX },
    { id: 'apa',    label: 'APA 7',  ext: 'txt', fn: formatAPA },
    { id: 'mla',    label: 'MLA 9',  ext: 'txt', fn: formatMLA },
    { id: 'chicago',label: 'Chicago',ext: 'txt', fn: formatChicago },
    { id: 'vancouver', label: 'Vancouver', ext: 'txt', fn: formatVancouver },
    { id: 'ris',    label: 'RIS',    ext: 'ris', fn: formatRIS },
];

// ── Component ─────────────────────────────────────────────────────────────────

const CitationExportPanel = ({ papers = [], defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [activeFormat, setActiveFormat] = useState('bibtex');
    const [copied, setCopied] = useState(false);

    if (papers.length === 0) return null;

    const currentFormat = FORMATS.find(f => f.id === activeFormat);
    const citationText = currentFormat ? currentFormat.fn(papers) : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(citationText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
            const el = document.createElement('textarea');
            el.value = citationText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([citationText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citations_${activeFormat}_${new Date().toISOString().split('T')[0]}.${currentFormat.ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mt-8 border border-white/10 rounded-3xl overflow-hidden bg-white/[0.01]">
            {/* Header toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.03] transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                        <BookMarked className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-black text-white uppercase tracking-widest">Export Citations</p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{papers.length} paper{papers.length !== 1 ? 's' : ''} · BibTeX, APA, MLA, Chicago, Vancouver, RIS</p>
                    </div>
                </div>
                {isOpen
                    ? <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                }
            </button>

            {isOpen && (
                <div className="px-6 pb-6 space-y-4 animate-slide-up">
                    {/* Format tabs */}
                    <div className="flex flex-wrap gap-2">
                        {FORMATS.map(fmt => (
                            <button
                                key={fmt.id}
                                onClick={() => setActiveFormat(fmt.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
                                    activeFormat === fmt.id
                                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                                        : 'bg-white/[0.02] text-slate-500 border-white/5 hover:text-white hover:border-white/15'
                                }`}
                            >
                                {fmt.label}
                            </button>
                        ))}
                    </div>

                    {/* Citation output */}
                    <div className="relative">
                        <pre className="w-full max-h-64 overflow-y-auto custom-scrollbar bg-black/30 border border-white/10 rounded-2xl p-5 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                            {citationText}
                        </pre>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                copied
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                            }`}
                        >
                            {copied
                                ? <><CheckCheck className="w-3.5 h-3.5" /> Copied!</>
                                : <><Copy className="w-3.5 h-3.5" /> Copy {currentFormat?.label}</>
                            }
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 text-xs font-black uppercase tracking-widest transition-all"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download .{currentFormat?.ext}
                        </button>
                        <span className="ml-auto text-[10px] text-slate-600 font-medium">
                            {papers.length} reference{papers.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CitationExportPanel;
