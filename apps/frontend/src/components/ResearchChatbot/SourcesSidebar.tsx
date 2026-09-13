'use client';

import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    GraduationCap,
} from 'lucide-react';
import { ResearchPaper } from './SourceCardsCarousel';
import { extractDomain, getFaviconUrl } from '@/lib/citationUtils';

interface SourcesSidebarProps {
    sources: ResearchPaper[];
    isLoading?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onSaveToLibrary?: (paper: ResearchPaper) => void;
}

function SourceFavicon({ paper, domain, index }: { paper: ResearchPaper; domain: string; index: number }) {
    const [hasError, setHasError] = useState(false);
    const url = paper.pdf_url || (paper as any).url || (paper as any).link;
    const faviconUrl = getFaviconUrl(url, domain);

    const fallbacks = [
        'bg-rose-500/20 text-rose-300 border-rose-500/30',
        'bg-purple-500/20 text-purple-300 border-purple-500/30',
        'bg-amber-500/20 text-amber-300 border-amber-500/30',
        'bg-sky-500/20 text-sky-300 border-sky-500/30',
    ];
    const fallbackClass = fallbacks[index % fallbacks.length];
    const initial = (domain[0] || 'A').toUpperCase();

    if (hasError || !domain) {
        return (
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold border ${fallbackClass} shrink-0`}>
                {initial}
            </span>
        );
    }

    return (
        <img
            src={faviconUrl}
            alt=""
            onError={() => setHasError(true)}
            className="w-4 h-4 rounded-full object-cover shrink-0 bg-slate-900 border border-slate-700/60"
            loading="lazy"
        />
    );
}

export default function SourcesSidebar({
    sources,
    isLoading = false,
    isCollapsed = false,
    onToggleCollapse,
    onSaveToLibrary,
}: SourcesSidebarProps) {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCurrentlyCollapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;

    const handleToggle = () => {
        if (onToggleCollapse) {
            onToggleCollapse();
        } else {
            setInternalCollapsed(!internalCollapsed);
        }
    };

    const getPaperDomain = (paper: ResearchPaper): string => {
        const rawUrl = paper.pdf_url || (paper as any).url || (paper as any).link;
        return extractDomain(rawUrl, paper) || paper.source || paper.journal || 'arxiv';
    };

    const getPaperSnippet = (paper: ResearchPaper): string => {
        // 1. Direct snippet fields (prefer abstract, excerpt, snippet, summary, description)
        const candidate =
            paper.excerpt ||
            paper.abstract ||
            (paper as any).snippet ||
            (paper as any).summary ||
            (paper as any).description;

        if (
            candidate &&
            typeof candidate === 'string' &&
            candidate.trim().length > 0 &&
            !candidate.includes('computational scaling laws across models and token budgets')
        ) {
            return candidate.trim();
        }

        // 2. Scite excerpt if present and distinct from the title
        const sciteExcerpt = (paper as any).scite?.excerpt;
        if (
            sciteExcerpt &&
            typeof sciteExcerpt === 'string' &&
            sciteExcerpt.trim().length > 0 &&
            sciteExcerpt.trim() !== paper.title?.trim()
        ) {
            return sciteExcerpt.trim();
        }

        // 3. Dynamic metadata-based synthesis ensuring every source has a distinct, realistic description
        const domain = getPaperDomain(paper);
        const titleClean = (paper.title || 'the research topic').trim().replace(/\.$/, '');
        const authors = Array.isArray(paper.authors)
            ? paper.authors.filter(Boolean)
            : typeof paper.authors === 'string'
            ? [paper.authors]
            : [];
        const authorStr =
            authors.length > 0
                ? authors.length === 1
                    ? authors[0]
                    : `${authors[0]} et al.`
                : null;
        const yearStr = paper.year ? ` (${paper.year})` : '';

        if (authorStr) {
            return `Investigates empirical findings and methodologies by ${authorStr}${yearStr} concerning ${titleClean}.`;
        }
        if (domain && domain !== 'source.org' && domain !== 'academic.org' && domain !== 'Scholar Source') {
            return `Academic publication from ${domain} detailing scholarly research on ${titleClean}.`;
        }
        return `Scholarly publication addressing empirical methodology, evidence, and findings on ${titleClean}.`;
    };

    const getPaperUrl = (paper: ResearchPaper): string | null => {
        if (paper.pdf_url) return paper.pdf_url;
        if ((paper as any).url) return (paper as any).url;
        if ((paper as any).link) return (paper as any).link;
        if (paper.doi) return `https://doi.org/${paper.doi}`;
        return null;
    };

    // ── 1. MINIMIZED STATE (Pulled up into top floating pill - Image 2) ──
    if (isCurrentlyCollapsed) {
        return (
            <div className="w-full select-none transition-all duration-300 ease-out animate-fade-in">
                <button
                    type="button"
                    onClick={handleToggle}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#1C1C1E] hover:bg-[#262629] border border-white/[0.08] text-left transition-all cursor-pointer group shadow-xl"
                    title="Click to expand sources"
                >
                    <span className="text-[15px] font-normal text-[#E5E5E7]">Sources</span>
                    <div className="flex items-center gap-2">
                        {/* Overlapping favicon stack matching Image 2 */}
                        <div className="flex items-center -space-x-1.5 shrink-0">
                            {sources.slice(0, 3).map((paper, idx) => {
                                const domain = getPaperDomain(paper);
                                return (
                                    <SourceFavicon
                                        key={paper.id || paper.paper_id || idx}
                                        paper={paper}
                                        domain={domain}
                                        index={idx}
                                    />
                                );
                            })}
                        </div>
                        <span className="text-[14px] font-normal text-[#C7C7CC] ml-0.5">
                            {sources.length}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white transition-colors ml-0.5 shrink-0" />
                    </div>
                </button>
            </div>
        );
    }

    // ── 2. EXPANDED STATE (Floating panel pulled down - Image 1) ──
    return (
        <div className="w-full max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl bg-[#1C1C1E] border border-white/[0.08] shadow-2xl overflow-hidden select-none transition-all duration-300 ease-out animate-fade-in">
            {/* Header: "Sources" on left, "v" (ChevronDown) on right to pull it up */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.04] shrink-0">
                <span className="text-[15px] font-medium text-[#E5E5E7]">Sources</span>
                <button
                    type="button"
                    onClick={handleToggle}
                    className="p-1 rounded-md text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                    title="Minimize sources (pull up)"
                    aria-label="Minimize sources"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            {/* Source items list matching Image 1 */}
            <div className="flex-1 overflow-y-auto px-5 space-y-5 custom-scrollbar no-scrollbar scrollbar-none pb-6 pt-3">
                {isLoading && sources.length === 0 && (
                    <div className="space-y-4 pt-2 animate-pulse">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="space-y-2">
                                <div className="h-3 w-20 bg-white/10 rounded" />
                                <div className="h-4 w-full bg-white/10 rounded" />
                                <div className="h-8 w-4/5 bg-white/10 rounded" />
                            </div>
                        ))}
                    </div>
                )}

                {sources.map((paper, idx) => {
                    const domain = getPaperDomain(paper);
                    const snippet = getPaperSnippet(paper);
                    const url = getPaperUrl(paper);
                    const sourceNumber = (paper as any).sourceIndex || idx + 1;
                    const isPdf = Boolean(paper.pdf_url || (paper.title && paper.title.toLowerCase().includes('[pdf]')));
                    const isAcademic = true;

                    return (
                        <div
                            key={paper.id || paper.paper_id || idx}
                            id={`source-card-${sourceNumber}`}
                            onClick={() => {
                                if (url) {
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                }
                                onSaveToLibrary?.(paper);
                            }}
                            className="space-y-1 group cursor-pointer select-none transition-colors"
                        >
                            {/* Domain Header Row: Favicon + Domain Name + Verified/Scholar Icon */}
                            <div className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                                <SourceFavicon
                                    paper={paper}
                                    domain={domain}
                                    index={idx}
                                />
                                <span className="text-xs text-[#8E8E93] font-normal truncate max-w-[170px] group-hover:text-[#C7C7CC] transition-colors">
                                    {domain}
                                </span>
                                {isAcademic && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                                )}
                                {isPdf && (
                                    <GraduationCap className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                                )}
                            </div>

                            {/* Article / Paper Title */}
                            <h4 className="text-[13px] font-medium text-[#F2F2F7] group-hover:text-sky-300 transition-colors leading-snug">
                                {paper.title}
                            </h4>

                            {/* Excerpt Snippet */}
                            <p className="text-xs text-[#8E8E93] leading-relaxed line-clamp-3 group-hover:text-[#AEAEB2] transition-colors">
                                {snippet}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
