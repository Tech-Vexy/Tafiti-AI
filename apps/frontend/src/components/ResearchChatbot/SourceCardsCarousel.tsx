'use client';

import React, { useState } from 'react';
import {
    ExternalLink,
    BookOpen,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    CheckCircle2,
    FileText,
    Globe2,
} from 'lucide-react';

import { getSourceDisplayUrl, getSourceVenueOrDomain, extractDomain, getFaviconUrl } from '@/lib/citationUtils';

export interface ResearchPaper {
    id?: string | number;
    paper_id?: string;
    title: string;
    abstract?: string;
    excerpt?: string;
    authors?: string[] | string;
    year?: number | string;
    doi?: string;
    citations_count?: number;
    citation_count?: number;
    citations?: number;
    source?: string;
    journal?: string;
    pdf_url?: string;
    is_oa?: boolean;
    url?: string;
}

interface SourceCardsCarouselProps {
    sources: ResearchPaper[];
    onSelectSource?: (source: ResearchPaper) => void;
    initialMinimized?: boolean;
}

export default function SourceCardsCarousel({
    sources,
    onSelectSource,
    initialMinimized = false,
}: SourceCardsCarouselProps) {
    const [expandedModalPaper, setExpandedModalPaper] = useState<ResearchPaper | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [isMinimized, setIsMinimized] = useState(initialMinimized);

    if (!sources || sources.length === 0) return null;

    const visibleSources = showAll ? sources : sources.slice(0, 8);

    const formatAuthors = (authors: any) => {
        if (!authors) return 'Academic Study';
        if (Array.isArray(authors)) {
            if (authors.length === 0) return 'Academic Study';
            if (authors.length === 1) return authors[0];
            return `${authors[0]} et al.`;
        }
        return String(authors);
    };

    const getCitationCount = (paper: ResearchPaper) => {
        return paper.citations ?? paper.citations_count ?? paper.citation_count ?? null;
    };

    const getSourceTag = (paper: ResearchPaper) => {
        const venue = getSourceVenueOrDomain(paper);
        const lower = venue.toLowerCase();
        if (lower.includes('arxiv')) return { label: 'arXiv', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
        if (lower.includes('nature') || lower.includes('springer')) return { label: 'Springer', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
        if (lower.includes('elsevier') || lower.includes('sciencedirect')) return { label: 'Elsevier', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
        if (lower.includes('core')) return { label: 'CORE', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
        if (lower.includes('ajol')) return { label: 'AJOL', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
        return { label: venue.length > 18 ? venue.slice(0, 16) + '…' : venue, color: 'bg-slate-800 text-slate-300 border-slate-700/50' };
    };

    // ── MINIMIZED / COLLAPSED STATE (Pushes vertically to the top like Perplexity.ai) ──
    if (isMinimized) {
        return (
            <div className="w-full my-2.5 animate-fade-in">
                <div
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group select-none shadow-sm"
                    title="Click to expand sources"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 tracking-tight">
                            Sources
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                            {sources.length}
                        </span>

                        {/* Domain Favicons Stack */}
                        <div className="hidden sm:flex items-center -space-x-1.5 shrink-0 ml-1">
                            {sources.slice(0, 4).map((paper, i) => {
                                const domain = extractDomain(paper.pdf_url || paper.url || (paper as any).link, paper);
                                const favicon = getFaviconUrl(paper.pdf_url || paper.url || (paper as any).link, domain);
                                return (
                                    <img
                                        key={i}
                                        src={favicon}
                                        alt=""
                                        className="w-4 h-4 rounded-full object-cover bg-slate-900 border border-slate-700/80"
                                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                    />
                                );
                            })}
                        </div>

                        <span className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                            {sources.slice(0, 3).map((s) => s.title).join(' • ')}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMinimized(false);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors shrink-0 ml-2"
                        aria-label="Expand sources"
                    >
                        <span>Expand</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-2.5 my-2.5 animate-fade-in">
            {/* Top Bar: Sources Analyzed + Minimize Button (pushes to top) */}
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-slate-200 uppercase tracking-wider text-[11px] font-semibold">
                        Sources ({sources.length})
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {sources.length > 4 && (
                        <button
                            type="button"
                            onClick={() => setShowAll(!showAll)}
                            className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
                        >
                            {showAll ? 'Show less' : `View all (${sources.length})`}
                            <ChevronRight className={`w-3 h-3 transition-transform ${showAll ? '-rotate-90' : ''}`} />
                        </button>
                    )}

                    {/* Minimize to top button */}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300 transition-colors px-2 py-0.5 rounded-md hover:bg-sky-500/10 cursor-pointer"
                        title="Minimize sources to top"
                        aria-label="Minimize sources"
                    >
                        <span>Minimize</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Perplexity-style horizontal source cards carousel */}
            <div className="flex items-stretch gap-2 sm:gap-2.5 overflow-x-auto pb-2 scrollbar-thin pt-0.5 overscroll-x-contain">
                {visibleSources.map((paper, idx) => {
                    const citCount = getCitationCount(paper);
                    const authorStr = formatAuthors(paper.authors);
                    const yearStr = paper.year ? `(${paper.year})` : '';
                    const tagInfo = getSourceTag(paper);
                    const sourceNumber = idx + 1;

                    return (
                        <div
                            key={paper.paper_id || paper.id || idx}
                            id={`source-card-${sourceNumber}`}
                            onClick={() => {
                                setExpandedModalPaper(paper);
                                onSelectSource?.(paper);
                            }}
                            className="w-[185px] sm:w-[220px] md:w-[240px] shrink-0 flex flex-col justify-between p-2.5 sm:p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-600 transition-all cursor-pointer group select-none shadow-sm"
                        >
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
                                    <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-400 font-bold flex items-center justify-center text-[10px] border border-sky-500/30 shrink-0 font-mono">
                                        {sourceNumber}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold uppercase truncate max-w-[120px] ${tagInfo.color}`}>
                                        {tagInfo.label}
                                    </span>
                                </div>

                                <h4 className="text-xs font-semibold text-slate-200 line-clamp-2 group-hover:text-sky-200 transition-colors leading-snug">
                                    {paper.title}
                                </h4>
                            </div>

                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                                <span className="truncate max-w-[110px] sm:max-w-[130px]" title={`${authorStr} ${yearStr}`}>
                                    {authorStr} {yearStr}
                                </span>
                                {citCount !== null && (
                                    <span className="font-semibold text-emerald-400 shrink-0 ml-1">
                                        ★ {citCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Source Details Modal */}
            {expandedModalPaper && (
                <div
                    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
                    onClick={() => setExpandedModalPaper(null)}
                >
                    <div
                        className="bg-slate-950 border border-slate-700 rounded-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded">
                                    {getSourceTag(expandedModalPaper).label} · {expandedModalPaper.journal || 'Academic Paper'}
                                </span>
                                <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-2 leading-snug">
                                    {expandedModalPaper.title}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 font-mono">
                                    {formatAuthors(expandedModalPaper.authors)} • {expandedModalPaper.year || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => setExpandedModalPaper(null)}
                                className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none"
                            >
                                ✕
                            </button>
                        </div>

                        {expandedModalPaper.abstract && (
                            <div className="space-y-1.5">
                                <h5 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">Abstract</h5>
                                <div className="max-h-52 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans pr-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                    {expandedModalPaper.abstract}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-mono text-xs">
                            <span className="text-slate-400">
                                {getCitationCount(expandedModalPaper) !== null && `★ Citations: ${getCitationCount(expandedModalPaper)}`}
                            </span>
                            <div className="flex items-center gap-2">
                                {expandedModalPaper.doi && (
                                    <a
                                        href={expandedModalPaper.doi.startsWith('http') ? expandedModalPaper.doi : `https://doi.org/${expandedModalPaper.doi}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/30 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        <span>View Paper DOI</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                                {expandedModalPaper.pdf_url && (
                                    <a
                                        href={expandedModalPaper.pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        <span>Full PDF</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
