import React, { Suspense } from 'react';
import { PaperCard } from './PaperCard';
import { SearchBox } from './SearchBox';
import { PreferenceForm } from './Recommendations';
import {
    Layers, Sparkles, Rocket, ArrowRight, Settings2, Activity,
    History, Loader2, Globe, CreditCard
} from 'lucide-react';

const SynthesisView = React.lazy(() =>
    import('./SynthesisView').then(m => ({ default: m.SynthesisView }))
);

const ViewFallback = () => (
    <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
);

const LANGUAGES = [
    { label: 'English', value: 'English' },
    { label: 'Kiswahili', value: 'Kiswahili' },
    { label: 'Français', value: 'French' },
    { label: 'العربية', value: 'Arabic' },
    { label: 'Español', value: 'Spanish' },
    { label: 'Português', value: 'Portuguese' },
    { label: 'हिन्दी', value: 'Hindi' },
    { label: 'Deutsch', value: 'German' },
    { label: '中文', value: 'Chinese (Simplified)' },
    { label: 'Amharic', value: 'Amharic' },
    { label: 'Yoruba', value: 'Yoruba' },
    { label: 'Hausa', value: 'Hausa' },
    { label: 'Zulu', value: 'Zulu' },
];

const SUGGESTED_SEARCHES = [
    'Malaria vaccine efficacy in sub-Saharan Africa',
    'Machine learning applications in African agriculture',
    'Climate change adaptation strategies East Africa',
    'Mobile health interventions low-resource settings',
    'Antibiotic resistance patterns Kenya Tanzania',
];

export function FeedView({
    searchBoxRef,
    papers,
    selectedPapers,
    library,
    history,
    isLoading,
    isHistoryLoading,
    isSynthesizing,
    synthesis,
    synthesisLanguage,
    outputLanguage,
    setOutputLanguage,
    lastQuery,
    followupQuestions,
    paperImpacts,
    isImpactLoading,
    isPremiumBlocked,
    isStartingTrial,
    trialNotStarted,
    showPreferenceForm,
    setShowPreferenceForm,
    isFetchRecs,
    onSearch,
    onSynthesize,
    onTogglePaper,
    onSavePaper,
    onClipPaper,
    onImpact,
    onGraph,
    onClipSynthesis,
    onFetchRecommendations,
    onRestoreHistory,
    onNavigateHistory,
    handleStartTrial,
    setActiveTab,
}) {
    return (
        <div className="space-y-12 animate-reveal">
            <header className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-1 sm:mb-2">Home</h2>
                    <p className="text-sm sm:text-base text-slate-500 font-medium">
                        Explore the latest academic breakthroughs.
                    </p>
                </div>
                <button
                    onClick={() => setShowPreferenceForm(!showPreferenceForm)}
                    className={`p-4 rounded-2xl border transition-all duration-500 ${showPreferenceForm
                        ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                        : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/10'
                        }`}
                    title="Customize recommendations"
                >
                    <Settings2 className="w-6 h-6" />
                </button>
            </header>

            <div className="relative z-10 glass-card-heavy p-2 border-indigo-500/10">
                <SearchBox ref={searchBoxRef} onSearch={onSearch} isLoading={isLoading} />
            </div>

            {showPreferenceForm && (
                <div className="animate-slide-up bg-indigo-500/5 rounded-3xl p-1 border border-indigo-500/20">
                    <PreferenceForm onSave={onFetchRecommendations} isLoading={isFetchRecs} />
                </div>
            )}

            {/* Search Results */}
            {papers.length > 0 ? (
                <div className="space-y-10 animate-reveal">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                                <Layers className="w-5 h-5" />
                            </div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight truncate">
                                Results for "{lastQuery}"
                            </h3>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Language selector */}
                            <div className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all">
                                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <select
                                    value={outputLanguage}
                                    onChange={e => setOutputLanguage(e.target.value)}
                                    className="bg-transparent text-xs font-black text-white uppercase tracking-widest appearance-none outline-none cursor-pointer pr-1"
                                    title="Output language for synthesis"
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.value} value={lang.value} className="bg-[#0f1117] text-white normal-case font-normal">
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {isPremiumBlocked ? (
                                <button
                                    onClick={() => trialNotStarted ? handleStartTrial() : setActiveTab('billing')}
                                    disabled={isStartingTrial}
                                    className="py-3 px-6 text-sm flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black hover:bg-amber-500/20 transition-all disabled:opacity-60"
                                >
                                    {isStartingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                                    {trialNotStarted ? 'Start Trial to Synthesize' : 'Upgrade to Synthesize'}
                                </button>
                            ) : (
                                <button
                                    onClick={onSynthesize}
                                    disabled={isSynthesizing || selectedPapers.length === 0}
                                    className="btn-primary py-3 px-6 text-sm flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className={`w-4 h-4 ${isSynthesizing ? 'animate-spin' : ''}`} />
                                    {isSynthesizing ? 'Synthesizing...' : `Synthesize ${selectedPapers.length} Papers`}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {papers.map((paper) => (
                            <PaperCard
                                key={paper.id}
                                paper={paper}
                                onSelect={onTogglePaper}
                                isSelected={!!selectedPapers.find(p => p.id === paper.id)}
                                onSave={onSavePaper}
                                isSaved={!!library.find(p => p.id === paper.id)}
                                onClip={onClipPaper}
                                onImpact={() => onImpact(paper.id)}
                                impact={paperImpacts[paper.id]}
                                isImpactLoading={isImpactLoading[paper.id]}
                                onGraph={p => onGraph(p)}
                            />
                        ))}
                    </div>

                    <div className="pt-12">
                        <Suspense fallback={<ViewFallback />}>
                            <SynthesisView
                                synthesis={synthesis}
                                papers={selectedPapers}
                                isLoading={isSynthesizing}
                                onClip={onClipSynthesis}
                                language={synthesisLanguage}
                            />
                        </Suspense>
                    </div>

                    {followupQuestions.length > 0 && (
                        <div className="pt-8 space-y-4 animate-reveal">
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Follow-up Questions</h4>
                            <div className="flex flex-col gap-3">
                                {followupQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onSearch(q)}
                                        className="text-left px-5 py-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-sm text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state with suggested searches */
                <div className="space-y-8">
                    <div className="glass-card p-12 sm:p-20 text-center space-y-6 border-dashed border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors group cursor-default">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 rounded-[2.5rem] mx-auto flex items-center justify-center group-hover:rotate-12 transition-transform duration-700">
                            <Rocket className="text-white/20 w-10 h-10 sm:w-12 sm:h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl sm:text-2xl font-bold text-white/40">Search for papers to get started.</h3>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">Enter a topic above, or try one of these suggested searches.</p>
                        </div>
                    </div>

                    {/* Suggested searches */}
                    <div className="space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-600 px-1">Suggested searches</p>
                        <div className="flex flex-col gap-2">
                            {SUGGESTED_SEARCHES.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSearch(q)}
                                    className="text-left px-5 py-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-slate-400 hover:bg-indigo-500/5 hover:border-indigo-500/15 hover:text-indigo-300 transition-all font-medium flex items-center justify-between group"
                                >
                                    <span>{q}</span>
                                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Research History — only shown when no search results */}
            {papers.length === 0 && (
                <div className="pt-8 border-t border-white/5 space-y-8 animate-reveal">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight text-white">Recent Research</h3>
                            <p className="text-sm text-slate-500 font-medium tracking-tight">Access your past academic syntheses.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {isHistoryLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                            </div>
                        ) : history.length > 0 ? (
                            history.slice(0, 5).map((item) => (
                                <div
                                    key={item.id}
                                    className="glass-card-heavy p-5 sm:p-8 space-y-4 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                    onClick={() => onRestoreHistory(item)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center shrink-0">
                                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <h3 className="font-black text-base sm:text-xl text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight truncate">
                                                {item.title}
                                            </h3>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest shrink-0 ml-11 sm:ml-0">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">{item.answer}</p>
                                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 pt-4 border-t border-white/5">
                                        <span>{item.papers.length} Sources</span>
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="w-6 h-6 rounded-full border border-[var(--bg-main)] bg-indigo-500/20" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 border border-dashed border-white/5 rounded-3xl">
                                <p className="text-slate-500 font-medium">No recent history found.</p>
                            </div>
                        )}
                    </div>

                    {history.length > 5 && (
                        <button
                            onClick={onNavigateHistory}
                            className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-500 font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all text-xs flex items-center justify-center gap-2 group"
                        >
                            View Full History
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default FeedView;
