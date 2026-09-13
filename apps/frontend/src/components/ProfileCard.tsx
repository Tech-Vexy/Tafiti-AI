import React from 'react';
import { User, School, Sparkles, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { useClerk, useUser } from '@clerk/nextjs';
import type { User as UserProfileData } from '@/types';

export const ProfileCard = ({ user }: { user?: (UserProfileData & { bio?: string }) | null }) => {
    const clerk = useClerk();
    const { user: clerkUser } = useUser();

    if (!user) return null;

    const displayName = clerkUser?.fullName || clerkUser?.username || user?.username || 'Researcher';
    const email = clerkUser?.primaryEmailAddress?.emailAddress || user?.email;
    const avatarUrl = clerkUser?.imageUrl || user?.imageUrl;
    const careerField = user?.career_field || 'Domain not set';

    return (
        <div className="glass-card p-6 border-white/10 space-y-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-emerald-400/20 border border-white/10 flex items-center justify-center relative group overflow-hidden shadow-md">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                        <User className="w-10 h-10 text-[var(--text-dim)]" />
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-bold tracking-tight text-[var(--text-main)]">{displayName}</h3>
                    {email && (
                        <p className="text-xs text-[var(--text-dim)] mt-0.5 truncate max-w-[220px]">{email}</p>
                    )}
                    <p className="text-xs text-[var(--text-dim)] flex items-center justify-center gap-1 mt-2">
                        <School className="w-3.5 h-3.5 text-sky-400" />
                        <span>{user.university || 'Independent Researcher'}</span>
                    </p>
                </div>

                {/* Active Research Domain Badge */}
                <div className="pt-2 w-full">
                    <div
                        className="px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border text-center"
                        style={{
                            background: 'var(--btn-surface)',
                            borderColor: 'var(--btn-border)',
                            color: 'var(--text-main)',
                        }}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">
                            {user?.career_field ? user.career_field : 'No research field set'}
                        </span>
                    </div>
                </div>

                {user.bio && (
                    <p className="text-xs text-[var(--text-dim)] italic line-clamp-3 px-2 pt-1">
                        "{user.bio}"
                    </p>
                )}
            </div>

            {/* Account Actions */}
            <div className="pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-glass)' }}>
                <button
                    onClick={() => clerk.openUserProfile()}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all group text-xs font-semibold"
                    style={{
                        background: 'var(--btn-surface)',
                        border: '1px solid var(--btn-border)',
                        color: 'var(--text-main)',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <Settings className="w-4 h-4 text-slate-400 group-hover:rotate-45 transition-transform" />
                        <span>Manage Account</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-dim)]">Clerk</span>
                </button>
                <button
                    onClick={() => clerk.signOut()}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all group text-xs font-semibold"
                    style={{
                        background: 'var(--danger-hover)',
                        border: '1px solid rgba(244, 63, 94, 0.15)',
                        color: 'var(--danger-text)',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

