// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, ExternalLink, Copy, Check, BookOpen } from 'lucide-react';

/**
 * CitationPill — Perplexity AI style inline citation badge with interactive hover popover
 */
export const CitationPill = ({ indices = [], sources = [], onSelectSource }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const timeoutRef = useRef(null);

    // Get matching sources for the provided indices
    const matchedSources = indices
        .map(idx => sources.find(s => s.index === idx))
        .filter(Boolean);

    const primarySource = matchedSources[0] || (sources[indices[0] - 1] ?? null);
    const additionalCount = matchedSources.length > 1 ? matchedSources.length - 1 : 0;
    const currentActiveSource = matchedSources[activeIdx] || primarySource;

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 250);
    };

    const handleCopyAPA = (e, source) => {
        e.stopPropagation();
        if (!source?.apaCitation) return;
        navigator.clipboard.writeText(source.apaCitation);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!primarySource) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 mx-0.5">
                [{indices.join(', ')}]
            </span>
        );
    }

    return (
        <span
            className="relative inline-block mx-1 align-baseline select-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Inline Perplexity-style badge */}
            <button
                type="button"
                onClick={() => onSelectSource && onSelectSource(primarySource)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] hover:bg-sky-500/15 text-slate-300 hover:text-white border border-white/10 hover:border-sky-500/30 transition-all duration-200 shadow-sm cursor-pointer group"
                title={primarySource.title}
            >
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="max-w-[110px] truncate text-[10px] tracking-tight text-slate-200">
                    {primarySource.domain || primarySource.authors[0] || 'Source'}
                </span>
                {additionalCount > 0 && (
                    <span className="px-1 py-0.2 rounded-full bg-white/10 text-sky-300 text-[9px] font-bold">
                        +{additionalCount}
                    </span>
                )}
            </button>

            {/* Hover Popover Modal */}
            {isHovered && (
                <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-[90vw] p-4 rounded-2xl bg-slate-950/95 border border-white/15 shadow-2xl backdrop-blur-2xl z-50 text-left animate-fade-in"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Multi-source tab indicator if multiple sources cited together */}
                    {matchedSources.length > 1 && (
                        <div className="flex items-center gap-1 mb-2.5 pb-2 border-b border-white/10">
                            {matchedSources.map((s, idx) => (
                                <button
                                    key={s.id || idx}
                                    onClick={() => setActiveIdx(idx)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                        activeIdx === idx
                                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    Source [{s.index}]
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Source Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                                {currentActiveSource.domain}
                            </span>
                            {currentActiveSource.isVerified && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                    Verified
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-sky-400 shrink-0">
                            [{currentActiveSource.index}]
                        </span>
                    </div>

                    {/* Title */}
                    <a
                        href={currentActiveSource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-bold text-white hover:text-sky-300 transition-colors line-clamp-2 leading-snug mb-2 group/title"
                    >
                        {currentActiveSource.title}
                        <ExternalLink className="inline-block w-2.5 h-2.5 ml-1 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                    </a>

                    {/* Text Overview / Snippet */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 mb-3">
                        <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
                            {currentActiveSource.snippet}
                        </p>
                    </div>

                    {/* Meta info & APA Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px]">
                        <span className="text-slate-500 truncate max-w-[130px]">
                            {currentActiveSource.authors?.[0] ? `${currentActiveSource.authors[0]} et al.` : ''} ({currentActiveSource.year || 'n.d.'})
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={(e) => handleCopyAPA(e, currentActiveSource)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/30 text-[10px] text-slate-300 hover:text-sky-200 transition-all"
                                title="Copy APA Citation"
                            >
                                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span className="font-semibold">{copied ? 'Copied APA' : 'Copy APA'}</span>
                            </button>
                            <a
                                href={currentActiveSource.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                title="Open Source"
                            >
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </span>
    );
};

export default CitationPill;
