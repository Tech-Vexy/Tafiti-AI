import React, { useEffect, useState } from 'react';
import { TrendingUp, Sparkles, ArrowUpRight, BookOpen } from 'lucide-react';
import api from '../api/client';

export const DiscoveryFeed = ({ careerField, onSearch, topics, isLoadingRecs }) => {
    const [trending, setTrending] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchTrending = async () => {
            setIsLoading(true);
            try {
                const response = await api.get(`/research/discovery/trending?field=${careerField || ''}`);
                setTrending(Array.isArray(response.data) ? response.data : []);
            } catch (e) {
                console.error("Discovery failed", e);
                setTrending([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrending();
    }, [careerField]);

    return (
        <div className="space-y-10">
            {/* Trending Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold">Trending in {careerField || 'Your Field'}</h3>
                    </div>
                </div>

                <div className="space-y-4">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-24 glass-card bg-white/5 animate-pulse" />)
                    ) : trending.map((paper, i) => (
                        <div
                            key={i}
                            className="glass-card p-4 border-white/5 hover:border-orange-500/30 transition-all group flex gap-4 items-start cursor-pointer"
                            onClick={() => onSearch(paper.title)}
                        >
                            <div className="min-w-[40px] h-10 bg-white/5 rounded-lg flex items-center justify-center font-black text-white/20">
                                0{i + 1}
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold line-clamp-2 group-hover:text-orange-400 transition-colors">
                                    {paper.title}
                                </h4>
                                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                                    <span>{paper.citations} citations</span>
                                    <span>•</span>
                                    <span>{paper.year}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Suggested Topics Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold">Discovery Topics</h3>
                </div>

                <div className="flex flex-wrap gap-2">
                    {topics.map((topic, i) => (
                        <button
                            key={i}
                            onClick={() => onSearch(topic.title)}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 hover:border-indigo-500/30 transition-all flex items-center gap-2 group"
                        >
                            {topic.title}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};
