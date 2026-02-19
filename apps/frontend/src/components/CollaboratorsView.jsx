import React from 'react';
import { Users, UserPlus, GraduationCap, MapPin, Sparkles } from 'lucide-react';

export const CollaboratorsView = ({ researchers, isLoading, onConnect }) => {
    if (isLoading) {
        return (
            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Users className="w-3 h-3" /> Potential Collaborators
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-card p-6 border-white/5 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/5 rounded-2xl" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-white/10 rounded w-2/3" />
                                    <div className="h-3 bg-white/5 rounded w-1/2" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!researchers || researchers.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Users className="w-3 h-3" /> Recommended Collaborators
                </h4>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/10">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Similarity Match</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {researchers.map((researcher) => (
                    <div
                        key={researcher.id}
                        className="glass-card p-6 border-white/5 hover:border-indigo-500/30 transition-all group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full -z-10 group-hover:bg-indigo-500/10 transition-colors" />

                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition-transform">
                                    <GraduationCap className="w-7 h-7 text-indigo-400" />
                                </div>
                                <div>
                                    <h5 className="font-black text-lg text-white group-hover:text-indigo-300 transition-colors">
                                        {researcher.username}
                                    </h5>
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] font-medium">
                                        <MapPin className="w-3 h-3" />
                                        {researcher.university || 'Independent Researcher'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black text-indigo-400 leading-none">
                                    {Math.round(researcher.similarity_score)}%
                                </div>
                                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                    Match
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {researcher.expertise_areas.slice(0, 3).map((area, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                                    >
                                        {area}
                                    </span>
                                ))}
                                {researcher.expertise_areas.length > 3 && (
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] self-center">
                                        +{researcher.expertise_areas.length - 3} more
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-[var(--text-dim)] line-clamp-2 leading-relaxed italic">
                                "{researcher.bio || 'Passionate about advancing shared research frontiers.'}"
                            </p>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); onConnect && onConnect(researcher.id); }}
                            className="w-full mt-6 py-3 bg-white/5 hover:bg-indigo-500/20 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-center gap-2 group/btn"
                        >
                            <UserPlus className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            Connect to Collaborate
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
