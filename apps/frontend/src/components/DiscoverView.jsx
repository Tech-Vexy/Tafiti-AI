import React, { useState } from 'react';
import {
    Compass,
    TrendingUp,
    Sparkles,
    Users,
    ArrowUpRight,
    Rocket,
    Search as SearchIcon,
    Filter,
    ChevronRight,
    Globe
} from 'lucide-react';
import { DiscoveryFeed } from './DiscoveryFeed';
import { CollaboratorsView } from './CollaboratorsView';
import { Recommendations, PreferenceForm } from './Recommendations';

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
    onConnect
}) => {
    const [activeSection, setActiveSection] = useState('trending'); // 'trending', 'topics', 'collaborators'

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            {/* Hero Header */}
            <header className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-indigo-600/20 via-indigo-900/10 to-transparent p-12 border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
                <div className="max-w-3xl space-y-6 relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-black uppercase tracking-widest">
                        <Compass className="w-4 h-4" /> Academic Explorer
                    </div>
                    <h1 className="text-5xl font-black tracking-tight text-white leading-tight">
                        Discover the Next <span className="text-indigo-400">Frontier</span> in {careerField || 'Science'}.
                    </h1>
                    <p className="text-xl text-[var(--text-dim)] leading-relaxed font-medium">
                        Real-time research trends, personalized topic suggestions, and potential collaborators curated for your academic journey.
                    </p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-6 border-b border-white/5 pb-2">
                {[
                    { id: 'trending', label: 'Trending Research', icon: TrendingUp, color: 'text-orange-400' },
                    { id: 'topics', label: 'Recommended Topics', icon: Sparkles, color: 'text-indigo-400' },
                    { id: 'collaborators', label: 'Potential Collaborators', icon: Users, color: 'text-emerald-400' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`group relative flex items-center gap-3 px-4 py-4 transition-all duration-300 font-bold text-sm ${activeSection === tab.id
                            ? 'text-white'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeSection === tab.id ? tab.color : 'text-slate-600 group-hover:text-slate-400'}`} />
                        {tab.label}
                        {activeSection === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-full animate-tab-in" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-12">
                    {activeSection === 'trending' && (
                        <div className="animate-reveal space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
                                    <TrendingUp className="text-orange-400" />
                                    Global Research Trends
                                </h2>
                                <button className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-white transition-colors">
                                    Last 24 Hours <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            <DiscoveryFeed
                                careerField={careerField}
                                onSearch={onSearch}
                                topics={[]}
                                isLoadingRecs={false}
                            />
                        </div>
                    )}

                    {activeSection === 'topics' && (
                        <div className="animate-reveal space-y-10">
                            {recs.length > 0 ? (
                                <Recommendations topics={recs} onSelect={onSearch} isLoading={isFetchRecs} />
                            ) : (
                                <div className="space-y-8">
                                    <div className="text-center py-20 glass-card-heavy border-dashed border-white/5 space-y-4">
                                        <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl mx-auto flex items-center justify-center">
                                            <Sparkles className="w-10 h-10 text-indigo-400" />
                                        </div>
                                        <h3 className="text-xl font-bold">No recommendations yet.</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto">Complete your profile preferences to see tailored research opportunities.</p>
                                    </div>
                                    <PreferenceForm onSave={onFetchRecommendations} isLoading={isFetchRecs} user={user} />
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'collaborators' && (
                        <div className="animate-reveal space-y-8">
                            <h2 className="text-2xl font-black tracking-tight flex items-center gap-4">
                                <Users className="text-emerald-400" />
                                Collaborator Network
                            </h2>
                            <CollaboratorsView researchers={similarResearchers} isLoading={isLoadingSimilar} onConnect={onConnect} />
                        </div>
                    )}
                </div>

                {/* Sidebar Discovery Tools */}
                <aside className="lg:col-span-4 space-y-8">
                    <div className="glass-card p-8 border-white/5 space-y-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div className="relative z-10 space-y-6">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-xl group-hover:scale-110 transition-transform">
                                <SearchIcon className="w-6 h-6" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black tracking-tight">Rapid Search</h3>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">Quickly pivot to a new field or concept across our indexed research database.</p>
                            </div>
                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search topic..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-indigo-500/30 transition-all font-medium"
                                    onKeyDown={(e) => e.key === 'Enter' && onSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass-card-heavy p-8 border-white/5 space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                            <Filter className="w-3 h-3" /> Quick Navigation
                        </h4>
                        <div className="space-y-4">
                            {[
                                {
                                    label: 'Top Citations',
                                    icon: Globe,
                                    query: `highly cited ${careerField || 'academic'} research`,
                                    filters: { min_citations: 100 }
                                },
                                {
                                    label: 'Interdisciplinary',
                                    icon: Sparkles,
                                    query: `interdisciplinary ${careerField || 'research'} applications`,
                                    filters: null
                                },
                                {
                                    label: 'Latest Pre-prints',
                                    icon: Rocket,
                                    query: `${careerField || 'recent research'}`,
                                    filters: { min_year: new Date().getFullYear() - 1 }
                                }
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSearch(item.query, item.filters)}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all text-sm font-bold group"
                                >
                                    <div className="flex items-center gap-3 text-slate-400 group-hover:text-white transition-colors">
                                        <item.icon className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                        {item.label}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};
