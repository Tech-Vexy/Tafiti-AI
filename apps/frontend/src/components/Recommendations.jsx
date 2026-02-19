import React from 'react';
import { Sparkles, ArrowRight, UserCircle, Briefcase, GraduationCap } from 'lucide-react';

export const Recommendations = ({ topics, onSelect, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card h-48 bg-white/5 border-white/5"></div>
                ))}
            </div>
        );
    }

    if (!topics || topics.length === 0) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center gap-4 border-b border-[var(--border-glass)] pb-6">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight">Personalized Suggestions</h3>
                    <p className="text-[var(--text-dim)]">AI-curated topics based on your professional profile</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map((topic, index) => (
                    <button
                        key={index}
                        onClick={() => onSelect(topic.title)}
                        className="group text-left glass-card p-6 border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-500 flex flex-col justify-between h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <ArrowRight className="w-4 h-4 text-emerald-400" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-lg font-bold group-hover:text-emerald-400 transition-colors leading-tight">
                                {topic.title}
                            </h4>
                            <p className="text-sm text-[var(--text-muted)] line-clamp-3">
                                {topic.description}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const PreferenceForm = ({ onSave, isLoading, user }) => {
    const [field, setField] = React.useState(user?.career_field || '');
    const [interests, setInterests] = React.useState(user?.expertise_areas?.join(', ') || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!field || !interests) return;
        onSave({
            career_field: field,
            interests: interests.split(',').map(i => i.trim()).filter(i => i)
        });
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card p-8 border-white/10 max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-black">Personalize Your Experience</h3>
                <p className="text-[var(--text-dim)]">Tell us about yourself to get tailored research topics.</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                        <Briefcase className="w-3 h-3" /> Career Field / Role
                    </label>
                    <input
                        type="text"
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        placeholder="e.g. Bio-Tech Researcher, Frontend Engineer..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                        <GraduationCap className="w-3 h-3" /> Areas of Interest
                    </label>
                    <textarea
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder="e.g. Distributed Systems, Neural Networks, Urban Planning..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                        required
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">Separate multiple interests with commas</p>
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || !field || !interests}
                className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50"
            >
                {isLoading ? (
                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        Generate My Recommendations
                    </>
                )}
            </button>
        </form>
    );
};
