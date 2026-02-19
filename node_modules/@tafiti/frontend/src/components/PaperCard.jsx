import React, { useState } from 'react';
import { Quote, Calendar, Star, ChevronRight, User, Bookmark, ExternalLink, FileText, Sparkles, Loader2, GitFork } from 'lucide-react';

export const PaperCard = React.memo(function PaperCard({
    paper, onSelect, isSelected, onSave, isSaved, onClip, onImpact, impact, isImpactLoading, onGraph
}) {
    const [localSaved, setLocalSaved] = useState(isSaved);
    const [showImpact, setShowImpact] = useState(false);

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
        <div
            onClick={() => onSelect(paper)}
            className={`
                glass-card p-8 cursor-pointer transition-all duration-700 group relative overflow-hidden backdrop-blur-3xl animate-reveal
                ${isSelected
                    ? 'ring-2 ring-indigo-500 bg-indigo-500/[0.04] translate-y-[-8px] shadow-2xl shadow-indigo-500/20'
                    : 'hover:bg-white/[0.04]'}
            `}
        >
            {/* Background Decorative Element */}
            <div className={`absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Top Section: Badges & Actions */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="px-4 py-1.5 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/20 backdrop-blur-md">
                        {paper.source || 'OpenAlex'}
                    </div>
                </div>
                <div className="flex gap-3">
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
                <h3 className="text-xl font-black leading-snug tracking-tight text-white group-hover:text-indigo-300 transition-colors duration-500">
                    {paper.title}
                </h3>

                {showImpact && impact ? (
                    <div className="animate-slide-up bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Personalized Impact for {impact.career_field}</span>
                            <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-[10px] font-black text-white">{impact.relevance_score}/10</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed italic border-l-2 border-indigo-500/30 pl-3">
                            "{impact.impact_summary}"
                        </p>
                        <div className="space-y-1 pt-1">
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Key Takeaway</span>
                            <p className="text-[11px] text-white font-bold leading-tight">{impact.key_takeaway}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className={`flex items-center gap-2 transition-all duration-500 ${isSelected ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Ready for Synthesis</span>
                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                </div>
                <button
                    className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); }}
                >
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

PaperCard.displayName = 'PaperCard';
