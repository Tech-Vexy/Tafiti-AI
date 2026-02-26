import React, { useState } from 'react';
import { Quote, Calendar, Star, ChevronRight, User, Bookmark, ExternalLink, FileText, Sparkles, Loader2, GitFork, Lock, Unlock, X, ChevronDown } from 'lucide-react';

// Paper Detail Drawer — full abstract + metadata overlay
function PaperDrawer({ paper, onClose }) {
    const doiUrl = paper.doi
        ? `https://doi.org/${paper.doi}`
        : paper.url || paper.landing_page_url;
    const isOA = paper.is_oa || paper.open_access || false;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative z-10 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto glass-card-heavy border-white/10 shadow-2xl rounded-t-3xl sm:rounded-[2.5rem] p-6 sm:p-10 space-y-6 animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-[11px] font-medium border border-indigo-500/20">
                            {paper.source || 'OpenAlex'}
                        </span>
                        {isOA ? (
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[11px] font-medium border border-emerald-500/20 flex items-center gap-1">
                                <Unlock className="w-3 h-3" /> Open Access
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-slate-500/10 text-slate-500 rounded-full text-[11px] font-medium border border-slate-500/20 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Paywalled
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Title */}
                <h2 className="text-lg sm:text-2xl font-black text-white leading-snug">{paper.title}</h2>

                {/* Metadata */}
                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-400" />
                        <span>{paper.authors?.join(', ') || 'Unknown authors'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span>{paper.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Quote className="w-4 h-4 text-emerald-400" />
                        <span>{paper.citations || 0} citations</span>
                    </div>
                    {paper.journal && (
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Published in</span>
                            <span className="text-white font-medium">{paper.journal}</span>
                        </div>
                    )}
                </div>

                {/* Abstract */}
                <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Abstract</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        {paper.abstract || 'No abstract available for this publication.'}
                    </p>
                </div>

                {/* DOI / Link */}
                {doiUrl && (
                    <a
                        href={doiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all text-sm font-medium w-fit"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {paper.doi ? `doi.org/${paper.doi}` : 'View Paper'}
                    </a>
                )}
            </div>
        </div>
    );
}

export const PaperCard = React.memo(function PaperCard({
    paper, onSelect, isSelected, onSave, isSaved, onClip, onImpact, impact, isImpactLoading, onGraph
}) {
    const [localSaved, setLocalSaved] = useState(isSaved);
    const [showImpact, setShowImpact] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);

    const isOA = paper.is_oa || paper.open_access || false;

    const handleSave = (e) => {
        e.stopPropagation();
        setLocalSaved(!localSaved);
        if (onSave) onSave(paper);
    };

    const handleImpactClick = (e) => {
        e.stopPropagation();
        setShowImpact(!showImpact);
        if (!impact && !isImpactLoading) {
            onImpact();
        }
    };

    return (
        <>
        {showDrawer && <PaperDrawer paper={paper} onClose={() => setShowDrawer(false)} />}
        <div
            onClick={() => onSelect(paper)}
            className={`
                glass-card p-5 sm:p-8 cursor-pointer transition-all duration-700 group relative overflow-hidden backdrop-blur-3xl animate-reveal
                ${isSelected
                    ? 'ring-2 ring-indigo-500 bg-indigo-500/[0.04] translate-y-[-2px] shadow-xl shadow-indigo-500/10'
                    : 'hover:bg-white/[0.04]'}
            `}
        >
            {/* Background Decorative Element */}
            <div className={`absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Top Section: Badges & Actions */}
            <div className="flex justify-between items-start mb-5 sm:mb-8 relative z-10">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-[11px] font-medium border border-indigo-500/20">
                        {paper.source || 'OpenAlex'}
                    </div>
                    {isOA ? (
                        <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[11px] font-medium border border-emerald-500/20 flex items-center gap-1" title="Open Access">
                            <Unlock className="w-2.5 h-2.5" /> OA
                        </div>
                    ) : (
                        <div className="px-2.5 py-1 bg-slate-500/10 text-slate-600 rounded-full text-[11px] font-medium border border-slate-700/30 flex items-center gap-1" title="Paywalled">
                            <Lock className="w-2.5 h-2.5" />
                        </div>
                    )}
                </div>
                <div className="flex gap-2 sm:gap-3">
                    <button
                        onClick={handleImpactClick}
                        className={`p-2.5 rounded-xl transition-all duration-300 border ${showImpact ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-slate-500 bg-white/5 border-white/5 hover:text-indigo-300 hover:border-indigo-500/20'}`}
                        title="AI Impact Explainer"
                    >
                        {isImpactLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className={`w-4 h-4 ${showImpact ? 'fill-indigo-400' : ''}`} />
                        )}
                    </button>
                    {onGraph && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onGraph(paper); }}
                            className="p-2.5 rounded-xl transition-all duration-300 border text-violet-400 bg-violet-500/5 border-violet-500/10 hover:bg-violet-500/15 hover:border-violet-500/30"
                            title="Live Citation Graph"
                        >
                            <GitFork className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClip && onClip(paper); }}
                        className="p-2.5 rounded-xl transition-all duration-300 border text-indigo-400 bg-indigo-500/5 border-indigo-500/10 hover:bg-indigo-500/10 hover:border-indigo-500/30"
                        title="Send to Notes"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSave}
                        className={`p-2.5 rounded-xl transition-all duration-300 border ${localSaved ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-500 bg-white/5 border-white/5 hover:text-white hover:border-white/10'}`}
                    >
                        <Bookmark className={`w-4 h-4 ${localSaved ? 'fill-emerald-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-5 relative z-10">
                <h3 className="text-base font-bold leading-snug text-white group-hover:text-indigo-300 transition-colors duration-300">
                    {paper.title}
                </h3>

                {showImpact && impact ? (
                    <div className="animate-slide-up bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-indigo-400">Impact · {impact.career_field}</span>
                            <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-xs font-semibold text-white">{impact.relevance_score}/10</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/30 pl-3">
                            "{impact.impact_summary}"
                        </p>
                        <div className="space-y-1 pt-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Key Takeaway</span>
                            <p className="text-xs text-white font-medium leading-snug">{impact.key_takeaway}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-slate-500">
                            <div className="flex items-center gap-2 group/author cursor-help">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover/author:border-indigo-500/30 transition-colors">
                                    <User className="w-3 h-3 group-hover/author:text-indigo-400 transition-colors" />
                                </div>
                                <span className="group-hover/author:text-slate-300 transition-colors">{paper.authors[0] || 'Unknown'} et al.</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-indigo-500/50" />
                                <span>{paper.year}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Quote className="w-3 h-3 text-emerald-500/50" />
                                <span className="text-emerald-500/70">{paper.citations || 0} Citations</span>
                            </div>
                        </div>

                        <p className="text-sm font-medium text-slate-400 line-clamp-3 leading-relaxed tracking-wide">
                            {paper.abstract || 'No abstract available for this publication.'}
                        </p>
                    </>
                )}
            </div>

            {/* Action Area */}
            <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className={`flex items-center gap-1.5 transition-all duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <span className="text-xs font-medium text-indigo-400">Selected</span>
                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                </div>
                <div className="flex items-center gap-1">
                    <button
                        className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                        title="Expand details"
                        onClick={(e) => { e.stopPropagation(); setShowDrawer(true); }}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                        className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                        title="Open paper"
                        onClick={(e) => {
                            e.stopPropagation();
                            const url = paper.doi
                                ? `https://doi.org/${paper.doi}`
                                : paper.url || paper.landing_page_url;
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
        </>
    );
});

PaperCard.displayName = 'PaperCard';
