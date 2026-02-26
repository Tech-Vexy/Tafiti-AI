import React, { useState } from 'react';
import {
    Sparkles,
    Users,
    RefreshCw,
    BookOpen,
    Search as SearchIcon,
    ChevronRight,
    Globe,
    Rocket,
    Briefcase,
    GraduationCap,
    Loader2,
} from 'lucide-react';
import { PaperCard } from './PaperCard';
import { CollaboratorsView } from './CollaboratorsView';

// ─── Preference Form ─────────────────────────────────────────────────────────
const PreferenceForm = ({ onSave, isLoading, user }) => {
    const [field, setField] = React.useState(user?.career_field || '');
    const [interests, setInterests] = React.useState(user?.expertise_areas?.join(', ') || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!field || !interests) return;
        onSave({
            career_field: field,
            interests: interests.split(',').map(i => i.trim()).filter(Boolean),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card p-8 border-white/10 max-w-2xl space-y-6">
            <div className="space-y-1">
                <h3 className="text-lg font-bold">Set Up Your Research Profile</h3>
                <p className="text-sm text-[var(--text-dim)]">
                    Tell us about your field and interests to receive personalized paper recommendations.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                        <Briefcase className="w-3 h-3" /> Career Field
                    </label>
                    <input
                        type="text"
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        placeholder="e.g. Biomedical Engineering, Computer Science…"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                        <GraduationCap className="w-3 h-3" /> Areas of Interest
                    </label>
                    <textarea
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder="e.g. Machine Learning, CRISPR, Urban Planning…"
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                        required
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">Separate multiple interests with commas.</p>
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || !field || !interests}
                className="btn-primary py-3 px-6 text-sm flex items-center gap-2 disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isLoading ? 'Generating…' : 'Generate Recommendations'}
            </button>
        </form>
    );
};

// ─── Topic Chips ─────────────────────────────────────────────────────────────
const TopicChips = ({ topics, onSelect, isLoading }) => {
    if (isLoading) {
        return (
            <div className="flex gap-2 flex-wrap animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-8 w-32 bg-white/5 rounded-full" />
                ))}
            </div>
        );
    }
    if (!topics || topics.length === 0) return null;

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Suggested Topics</p>
            <div className="flex gap-2 flex-wrap">
                {topics.map((topic, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(topic.title)}
                        title={topic.description}
                        className="px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all"
                    >
                        {topic.title}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ─── Paper Skeleton ───────────────────────────────────────────────────────────
const PaperSkeleton = () => (
    <div className="glass-card p-6 animate-pulse space-y-4">
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="space-y-2 pt-2">
            <div className="h-3 bg-white/5 rounded" />
            <div className="h-3 bg-white/5 rounded w-5/6" />
        </div>
    </div>
);

// ─── Main DiscoverView ────────────────────────────────────────────────────────
export const DiscoverView = ({
    user,
    recs,
    isFetchRecs,
    onSearch,
    careerField,
    similarResearchers,
    isLoadingSimilar,
    handleSavePaper,
    onFetchRecommendations,
    onConnect,
    discoverPapers,
    isLoadingDiscover,
    onRefreshDiscover,
    library = [],
}) => {
    const [activeSection, setActiveSection] = useState('papers');
    const [selectedPapers, setSelectedPapers] = useState([]);

    const hasProfile = !!(
        user?.career_field || (user?.expertise_areas && user.expertise_areas.length > 0)
    );

    const togglePaper = (paper) => {
        setSelectedPapers(prev =>
            prev.find(p => p.id === paper.id)
                ? prev.filter(p => p.id !== paper.id)
                : [...prev, paper]
        );
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Page Header */}
            <header className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-white">Discover</h1>
                <p className="text-sm text-[var(--text-dim)]">
                    Papers and researchers matched to your profile and research history.
                </p>
            </header>

            {/* Section Tabs */}
            <nav className="flex items-center gap-0 border-b border-white/5">
                {[
                    { id: 'papers', label: 'For You', icon: BookOpen },
                    { id: 'collaborators', label: 'Researchers', icon: Users },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all relative ${
                            activeSection === tab.id
                                ? 'text-white'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeSection === tab.id ? 'text-indigo-400' : 'text-slate-600'}`} />
                        {tab.label}
                        {activeSection === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full" />
                        )}
                    </button>
                ))}
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-8">
                    {activeSection === 'papers' && (
                        <div className="space-y-8 animate-reveal">
                            {!hasProfile ? (
                                /* No profile yet — show setup */
                                <div className="space-y-6">
                                    <div className="glass-card-heavy p-10 text-center space-y-4 border-dashed border-white/5">
                                        <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl mx-auto flex items-center justify-center">
                                            <Sparkles className="w-7 h-7 text-indigo-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold">Complete your profile</h3>
                                            <p className="text-sm text-[var(--text-dim)] max-w-sm mx-auto">
                                                Add your career field and research interests to see papers matched to your work.
                                            </p>
                                        </div>
                                    </div>
                                    <PreferenceForm onSave={onFetchRecommendations} isLoading={isFetchRecs} user={user} />
                                </div>
                            ) : (
                                <>
                                    {/* Suggested topic chips */}
                                    <TopicChips topics={recs} onSelect={onSearch} isLoading={isFetchRecs} />

                                    {/* Paper feed header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-base font-bold text-white">Recommended Papers</h2>
                                            <p className="text-xs text-[var(--text-dim)] mt-0.5">
                                                Tailored to your field{careerField ? ` — ${careerField}` : ''}, expertise, and recent searches.
                                            </p>
                                        </div>
                                        <button
                                            onClick={onRefreshDiscover}
                                            disabled={isLoadingDiscover}
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-white/5 rounded-xl hover:border-white/10 transition-all disabled:opacity-40"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiscover ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Paper grid */}
                                    {isLoadingDiscover ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {[1, 2, 3, 4].map(i => <PaperSkeleton key={i} />)}
                                        </div>
                                    ) : discoverPapers && discoverPapers.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {discoverPapers.map(paper => (
                                                <PaperCard
                                                    key={paper.id}
                                                    paper={paper}
                                                    onSelect={togglePaper}
                                                    isSelected={!!selectedPapers.find(p => p.id === paper.id)}
                                                    onSave={handleSavePaper}
                                                    isSaved={!!library.find(p => p.id === paper.id)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="glass-card-heavy p-12 text-center border-dashed border-white/5">
                                            <p className="text-sm text-slate-500">No papers found. Try refreshing or updating your profile below.</p>
                                        </div>
                                    )}

                                    {/* Update profile link */}
                                    <div className="pt-4 border-t border-white/5">
                                        <PreferenceForm onSave={onFetchRecommendations} isLoading={isFetchRecs} user={user} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeSection === 'collaborators' && (
                        <div className="space-y-5 animate-reveal">
                            <div>
                                <h2 className="text-base font-bold text-white">Researchers in Your Field</h2>
                                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                                    Other researchers with overlapping expertise.
                                </p>
                            </div>
                            <CollaboratorsView
                                researchers={similarResearchers}
                                isLoading={isLoadingSimilar}
                                onConnect={onConnect}
                            />
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="lg:col-span-4 space-y-5">
                    {/* Quick Search */}
                    <div className="glass-card p-5 border-white/5 space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <SearchIcon className="w-4 h-4 text-indigo-400" /> Search
                        </h3>
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search a topic…"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:border-indigo-500/30 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && onSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Quick filters */}
                    <div className="glass-card-heavy p-5 border-white/5 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by</h4>
                        <div className="space-y-1.5">
                            {[
                                { label: 'Highly Cited', icon: Globe, query: `highly cited ${careerField || 'research'}`, filters: { min_citations: 100 } },
                                { label: 'Interdisciplinary', icon: Sparkles, query: `interdisciplinary ${careerField || 'research'}` },
                                { label: 'Recent Publications', icon: Rocket, query: careerField || 'recent research', filters: { min_year: new Date().getFullYear() - 1 } },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSearch(item.query, item.filters)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all text-sm font-medium group"
                                >
                                    <div className="flex items-center gap-2.5 text-slate-400 group-hover:text-white transition-colors">
                                        <item.icon className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                                        {item.label}
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-indigo-400 transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Profile summary */}
                    {hasProfile && (
                        <div className="glass-card p-5 border-white/5 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Profile</h4>
                            <div className="space-y-2">
                                {user?.career_field && (
                                    <div className="text-sm text-slate-300 flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        {user.career_field}
                                    </div>
                                )}
                                {user?.expertise_areas?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {user.expertise_areas.slice(0, 6).map((area, i) => (
                                            <span
                                                key={i}
                                                className="px-2.5 py-1 bg-white/5 rounded-full text-[11px] text-slate-400 border border-white/5"
                                            >
                                                {area}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};
