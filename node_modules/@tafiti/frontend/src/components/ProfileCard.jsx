import React from 'react';
import { User, School, Quote, Activity, Award, Settings, LogOut } from 'lucide-react';
import { useClerk, useUser } from '@clerk/clerk-react';

export const ProfileCard = ({ user }) => {
    const clerk = useClerk();
    const { user: clerkUser } = useUser();

    if (!user) return null;

    const stats = [
        { label: 'Citations', value: user.citation_count || 0, icon: Quote, color: 'text-indigo-400' },
        { label: 'Interest Score', value: user.interest_score || 0, icon: Activity, color: 'text-emerald-400' },
        { label: 'Publications', value: user.publication_count || 0, icon: Award, color: 'text-amber-400' },
    ];

    return (
        <div className="glass-card p-6 border-white/10 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-emerald-400/20 border border-white/10 flex items-center justify-center relative group overflow-hidden">
                    {clerkUser?.imageUrl ? (
                        <img src={clerkUser.imageUrl} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                        <User className="w-12 h-12 text-white/50 group-hover:scale-110 transition-transform" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div>
                    <h3 className="text-xl font-bold tracking-tight">{user.username}</h3>
                    <p className="text-sm text-[var(--text-dim)] flex items-center justify-center gap-1 mt-1">
                        <School className="w-3 h-3" /> {user.university || 'Independent Researcher'}
                    </p>
                </div>

                <p className="text-sm text-[var(--text-muted)] line-clamp-3 italic">
                    "{user.bio || 'Developing the next generation of academic discovery tools.'}"
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                {stats.map((stat, i) => (
                    <div key={i} className="text-center space-y-1">
                        <stat.icon className={`w-4 h-4 mx-auto ${stat.color}`} />
                        <div className="text-lg font-black">{stat.value}</div>
                        <div className="text-[10px] uppercase font-bold tracking-tighter text-[var(--text-muted)]">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Research Interests</h4>
                <div className="flex flex-wrap gap-2">
                    {(user.expertise_areas?.length > 0 ? user.expertise_areas : ['AI', 'Open Science']).map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-bold text-white/70">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Account Management Section */}
            <div className="pt-6 border-t border-white/5 space-y-3">
                <button
                    onClick={() => clerk.openUserProfile()}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest">Manage Account</span>
                    </div>
                </button>
                <button
                    onClick={() => clerk.signOut()}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                    </div>
                </button>
            </div>
        </div>
    );
};
