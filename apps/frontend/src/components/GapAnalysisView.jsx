import React, { useState } from 'react';
import {
    FlaskConical, Loader2, Sparkles, MapPin, Wrench, Clock, Users,
    BookOpen, Network, ChevronRight, FileText, AlertTriangle,
    CheckCircle2, Circle, X, Plus, Search, BookMarked, Lightbulb,
    BarChart3, ArrowRight, ClipboardList
} from 'lucide-react';
import api from '../api/client';

// ── Visual style maps ──────────────────────────────────────────────────────────

const CATEGORY_STYLES = {
    Geographic: {
        bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20',
        dot: 'bg-blue-400', icon: MapPin,
    },
    Methodological: {
        bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20',
        dot: 'bg-purple-400', icon: Wrench,
    },
    Temporal: {
        bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20',
        dot: 'bg-amber-400', icon: Clock,
    },
    Demographic: {
        bg: 'bg-pink-500/10', text: 'text-pink-300', border: 'border-pink-500/20',
        dot: 'bg-pink-400', icon: Users,
    },
    Theoretical: {
        bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20',
        dot: 'bg-emerald-400', icon: BookOpen,
    },
    Interdisciplinary: {
        bg: 'bg-orange-500/10', text: 'text-orange-300', border: 'border-orange-500/20',
        dot: 'bg-orange-400', icon: Network,
    },
};

const URGENCY_STYLES = {
    High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', icon: AlertTriangle },
    Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: Circle },
    Low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: CheckCircle2 },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const CategoryBadge = ({ category }) => {
    const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Theoretical;
    const Icon = style.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${style.bg} ${style.text} ${style.border}`}>
            <Icon className="w-3 h-3" />
            {category}
        </span>
    );
};

const UrgencyBadge = ({ urgency }) => {
    const style = URGENCY_STYLES[urgency] || URGENCY_STYLES.Medium;
    const Icon = style.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${style.bg} ${style.text} ${style.border}`}>
            <Icon className="w-2.5 h-2.5" />
            {urgency} Priority
        </span>
    );
};

const GapCard = ({ gap, index, onClipToNotes }) => {
    const [expanded, setExpanded] = useState(false);
    const catStyle = CATEGORY_STYLES[gap.category] || CATEGORY_STYLES.Theoretical;

    return (
        <div className={`glass-card p-6 space-y-4 transition-all duration-500 animate-reveal border-l-2 ${catStyle.border}`}
            style={{ animationDelay: `${index * 80}ms` }}>

            {/* Header Row */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${catStyle.bg} border ${catStyle.border}`}>
                        <div className={`w-2 h-2 rounded-full ${catStyle.dot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black text-white leading-tight tracking-tight">{gap.title}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <CategoryBadge category={gap.category} />
                            <UrgencyBadge urgency={gap.urgency} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-400 leading-relaxed font-medium pl-11">
                {gap.description}
            </p>

            {/* Suggested Questions */}
            <div className="pl-11 space-y-2">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                    <Lightbulb className="w-3 h-3" />
                    {gap.suggested_questions?.length || 0} Suggested Research Questions
                    <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>

                {expanded && (
                    <div className="space-y-2 animate-slide-up">
                        {gap.suggested_questions?.map((q, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[9px] font-black text-indigo-400">{i + 1}</span>
                                </div>
                                <p className="text-xs text-slate-300 font-medium leading-relaxed italic">"{q}"</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Clip to Notes */}
            <div className="pl-11 pt-2 border-t border-white/5 flex justify-end">
                <button
                    onClick={() => onClipToNotes(gap)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
                >
                    <FileText className="w-3 h-3" />
                    Add to Notes
                </button>
            </div>
        </div>
    );
};

// ── Gap Results Section (needs own state for category filter) ─────────────────

const GapResultsSection = ({ gaps, onClipGapToNotes }) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const categories = [...new Set(gaps.map(g => g.category))];
    const visibleGaps = activeCategory === 'All'
        ? gaps
        : gaps.filter(g => g.category === activeCategory);

    return (
        <div className="space-y-6">
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
                {['All', ...categories].map(cat => {
                    const style = cat !== 'All' ? CATEGORY_STYLES[cat] : null;
                    const count = cat === 'All' ? gaps.length : gaps.filter(g => g.category === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all duration-300 ${
                                activeCategory === cat
                                    ? (style ? `${style.bg} ${style.text} ${style.border}` : 'bg-white/10 text-white border-white/20')
                                    : 'bg-white/[0.02] text-slate-500 border-white/5 hover:text-white hover:border-white/10'
                            }`}
                        >
                            {cat} <span className="ml-1 opacity-60">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Gap Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visibleGaps.map((gap, i) => (
                    <GapCard
                        key={`${gap.category}-${i}`}
                        gap={gap}
                        index={i}
                        onClipToNotes={onClipGapToNotes}
                    />
                ))}
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const GapAnalysisView = ({ papers = [], library = [], onClipToNotes }) => {
    // Corpus state — user toggles which papers to include
    const [corpusPapers, setCorpusPapers] = useState([]);
    const [researchContext, setResearchContext] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [activeSource, setActiveSource] = useState('search'); // 'search' | 'library'
    const [filterQuery, setFilterQuery] = useState('');

    const allPapers = activeSource === 'search' ? papers : library;
    const filteredPapers = allPapers.filter(p =>
        p.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (p.authors[0] || '').toLowerCase().includes(filterQuery.toLowerCase())
    );

    const togglePaper = (paper) => {
        setCorpusPapers(prev =>
            prev.find(p => p.id === paper.id)
                ? prev.filter(p => p.id !== paper.id)
                : [...prev, paper]
        );
    };

    const isInCorpus = (paper) => !!corpusPapers.find(p => p.id === paper.id);

    const handleRunAnalysis = async () => {
        if (corpusPapers.length < 2) {
            setError('Please select at least 2 papers for gap analysis.');
            return;
        }
        setError('');
        setIsLoading(true);
        setResult(null);

        try {
            const response = await api.post('/research/gap-analysis', {
                papers: corpusPapers,
                research_context: researchContext.trim() || null,
            });
            setResult(response.data);
        } catch (err) {
            setError(err?.response?.data?.detail || 'Gap analysis failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClipGapToNotes = async (gap) => {
        if (!onClipToNotes) return;
        const questions = gap.suggested_questions?.map((q, i) => `${i + 1}. ${q}`).join('\n') || '';
        const content = `## Research Gap: ${gap.title}\n\n**Category:** ${gap.category}  |  **Priority:** ${gap.urgency}\n\n${gap.description}\n\n### Suggested Research Questions\n${questions}`;
        onClipToNotes({
            title: `Gap: ${gap.title.slice(0, 60)}`,
            content,
            tags: ['gap-analysis', gap.category.toLowerCase(), 'research-gap'],
        });
    };

    const handleClipFullReport = async () => {
        if (!result || !onClipToNotes) return;
        const gapLines = result.gaps.map(g => {
            const qs = g.suggested_questions?.map((q, i) => `  ${i + 1}. ${q}`).join('\n') || '';
            return `### ${g.title}\n**${g.category}** · ${g.urgency} Priority\n\n${g.description}\n\n**Suggested Questions:**\n${qs}`;
        }).join('\n\n---\n\n');
        const content = `# Gap Analysis Report\n\n**Summary:** ${result.summary}\n\n**Papers Analyzed:** ${result.papers_analyzed}  |  **Gaps Found:** ${result.gaps.length}\n\n---\n\n${gapLines}`;
        onClipToNotes({
            title: `Gap Analysis — ${new Date().toLocaleDateString()}`,
            content,
            tags: ['gap-analysis', 'report'],
        });
    };

    // Urgency counters
    const urgencyCounts = result
        ? result.gaps.reduce((acc, g) => { acc[g.urgency] = (acc[g.urgency] || 0) + 1; return acc; }, {})
        : {};

    return (
        <div className="space-y-10 animate-reveal">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="space-y-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                        <FlaskConical className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-white">Gap Analysis</h2>
                        <p className="text-slate-500 font-medium tracking-tight">
                            Discover what's missing from your research corpus.
                        </p>
                    </div>
                </div>
            </header>

            {/* ── Corpus Builder ───────────────────────────────────────────── */}
            <div className="glass-card-heavy p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Build Your Corpus</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Select papers to analyze — minimum 2, up to 20.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-black">
                            {corpusPapers.length} Selected
                        </div>
                        {corpusPapers.length > 0 && (
                            <button
                                onClick={() => setCorpusPapers([])}
                                className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Clear selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Source Tabs */}
                <div className="flex gap-2">
                    {['search', 'library'].map(src => (
                        <button
                            key={src}
                            onClick={() => { setActiveSource(src); setFilterQuery(''); }}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSource === src ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                            {src === 'search' ? (
                                <span className="flex items-center gap-2"><Search className="w-3 h-3" />Search Results ({papers.length})</span>
                            ) : (
                                <span className="flex items-center gap-2"><BookMarked className="w-3 h-3" />My Library ({library.length})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Filter Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={e => setFilterQuery(e.target.value)}
                        placeholder="Filter papers by title or author…"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.07] transition-all"
                    />
                </div>

                {/* Paper List */}
                {filteredPapers.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                        <p className="text-slate-500 text-sm font-medium">
                            {papers.length === 0 && library.length === 0
                                ? 'Search for papers on the Home tab first, then come back here.'
                                : 'No papers match your filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {filteredPapers.map((paper) => {
                            const selected = isInCorpus(paper);
                            return (
                                <button
                                    key={paper.id}
                                    onClick={() => togglePaper(paper)}
                                    className={`text-left p-4 rounded-2xl border transition-all duration-300 group ${selected
                                        ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${selected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                            {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-bold leading-snug line-clamp-2 transition-colors ${selected ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                                {paper.title}
                                            </p>
                                            <p className="text-[10px] text-slate-600 mt-1 font-medium">
                                                {paper.authors?.[0] || 'Unknown'} · {paper.year}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Selected pills */}
                {corpusPapers.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Corpus ({corpusPapers.length} papers)</p>
                        <div className="flex flex-wrap gap-2">
                            {corpusPapers.map(p => (
                                <span key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold max-w-[240px]">
                                    <span className="truncate">{p.title.slice(0, 35)}{p.title.length > 35 ? '…' : ''}</span>
                                    <button onClick={() => togglePaper(p)} className="shrink-0 hover:text-red-400 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Research Context ─────────────────────────────────────────── */}
            <div className="glass-card-heavy p-6 space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Research Context <span className="text-slate-600 normal-case font-medium tracking-normal">(optional — helps the AI personalize the gap analysis)</span>
                </label>
                <textarea
                    value={researchContext}
                    onChange={e => setResearchContext(e.target.value)}
                    placeholder="e.g. PhD thesis on AI ethics in rural Sub-Saharan Africa, focusing on healthcare applications…"
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.07] transition-all resize-none"
                />
            </div>

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-slide-up">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Run Button ───────────────────────────────────────────────── */}
            <button
                onClick={handleRunAnalysis}
                disabled={isLoading || corpusPapers.length < 2}
                className="w-full btn-primary py-5 text-base font-black flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed group"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Research Corpus…
                    </>
                ) : (
                    <>
                        <FlaskConical className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Run Gap Analysis on {corpusPapers.length} Paper{corpusPapers.length !== 1 ? 's' : ''}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>

            {/* ── Results ─────────────────────────────────────────────────── */}
            {result && (
                <div className="space-y-8 animate-reveal">

                    {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Papers Analyzed', value: result.papers_analyzed, icon: BookOpen, color: 'text-indigo-400' },
                            { label: 'Gaps Identified', value: result.gaps.length, icon: FlaskConical, color: 'text-emerald-400' },
                            { label: 'High Priority', value: urgencyCounts.High || 0, icon: AlertTriangle, color: 'text-red-400' },
                            { label: 'Analysis Time', value: `${result.processing_time.toFixed(1)}s`, icon: Clock, color: 'text-amber-400' },
                        ].map((stat) => (
                            <div key={stat.label} className="glass-card-heavy p-5 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-white">{stat.value}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Card */}
                    <div className="glass-card-heavy p-8 space-y-4 border border-indigo-500/10 bg-indigo-500/[0.02]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-300">Executive Summary</h3>
                            </div>
                            <button
                                onClick={handleClipFullReport}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
                            >
                                <ClipboardList className="w-3.5 h-3.5" />
                                Save Full Report
                            </button>
                        </div>
                        <p className="text-base text-slate-300 leading-relaxed font-medium">{result.summary}</p>
                    </div>

                    {/* Category Filter Tabs + Gap Cards */}
                    {result.gaps.length > 0 && (
                        <GapResultsSection
                            gaps={result.gaps}
                            onClipGapToNotes={handleClipGapToNotes}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default GapAnalysisView;
