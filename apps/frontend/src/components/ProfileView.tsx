// @ts-nocheck
import React from 'react';
import Link from 'next/link';
import { useClerk, useUser } from '@clerk/nextjs';
import {
    Settings, LogOut, User as UserIcon, CreditCard, Calendar, ArrowUpRight, ShieldCheck, Clock, Sparkles
} from 'lucide-react';
import { getFieldById } from '@/components/ResearchChatbot/researchFields';

export const ProfileView = ({ user }) => {
    const clerk = useClerk();
    const { user: clerkUser } = useUser();

    const displayName = clerkUser?.fullName || clerkUser?.username || user?.username || 'Researcher';
    const email = clerkUser?.primaryEmailAddress?.emailAddress || user?.email;
    const avatarUrl = clerkUser?.imageUrl || user?.imageUrl;

    // Derived database-backed subscription details
    const getSubscriptionInfo = () => {
        const status = user?.subscription_status || 'trialing';
        const isSuperuser = !!user?.is_superuser;

        if (isSuperuser) {
            return {
                name: 'Tafiti Academic Superuser',
                badge: 'Lifetime',
                expiryLabel: 'Permanent Access',
                badgeBg: 'rgba(253, 251, 250, 0.1)',
                badgeText: '#FDFBFA',
            };
        }

        if (status === 'active') {
            const endsAt = user?.subscription_ends_at;
            const formattedDate = endsAt
                ? new Date(endsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : null;
            return {
                name: 'Tafiti Pro Plan',
                badge: 'Active',
                expiryLabel: formattedDate ? `Renews: ${formattedDate}` : 'Active Subscription',
                badgeBg: 'rgba(16, 185, 129, 0.15)',
                badgeText: '#34d399',
            };
        }

        if (status === 'trialing' && user?.trial_ends_at) {
            const endsAt = user?.trial_ends_at;
            const isExpired = new Date(endsAt).getTime() < Date.now();
            const daysLeft = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const formattedDate = new Date(endsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            if (isExpired) {
                return {
                    name: 'Free Trial',
                    badge: 'Expired',
                    expiryLabel: `Expired on ${formattedDate}`,
                    badgeBg: 'rgba(244, 63, 94, 0.15)',
                    badgeText: '#fb7185',
                };
            }

            return {
                name: 'Free Trial',
                badge: `${daysLeft}d left`,
                expiryLabel: `Expires: ${formattedDate}`,
                badgeBg: 'rgba(253, 251, 250, 0.12)',
                badgeText: 'var(--text-main)',
            };
        }

        if (status === 'expired') {
            return {
                name: 'Free Trial',
                badge: 'Expired',
                expiryLabel: user?.trial_ends_at ? `Expired: ${new Date(user.trial_ends_at).toLocaleDateString()}` : 'Expired',
                badgeBg: 'rgba(244, 63, 94, 0.15)',
                badgeText: '#fb7185',
            };
        }

        return {
            name: 'Free Plan',
            badge: 'Inactive',
            expiryLabel: 'No active plan',
            badgeBg: 'rgba(138, 136, 132, 0.15)',
            badgeText: 'var(--text-muted)',
        };
    };

    const subInfo = getSubscriptionInfo();

    return (
        <div className="min-h-[70vh] flex flex-col justify-center max-w-2xl mx-auto px-4 sm:px-6 py-10 animate-reveal">
            {/* Header row */}
            <div className="pb-6">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
                    Account Overview
                </h1>
                <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                    Manage your account credentials, security, and subscription status
                </p>
            </div>

            {/* Account Card */}
            <div
                className="rounded-2xl p-6 sm:p-7 border space-y-6 shadow-sm"
                style={{
                    background: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                }}
            >
                {/* User Identity & Account Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border"
                            style={{
                                background: 'var(--btn-surface)',
                                borderColor: 'var(--btn-border)',
                            }}
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-6 h-6 text-[var(--text-dim)]" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold truncate text-[var(--text-main)]">{displayName}</h2>
                            {email && (
                                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-dim)' }}>{email}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => clerk.openUserProfile?.()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-[var(--sidebar-hover)]"
                            style={{
                                background: 'var(--btn-surface)',
                                border: '1px solid var(--btn-border)',
                                color: 'var(--text-main)',
                            }}
                            title="Manage Account"
                        >
                            <Settings className="w-3.5 h-3.5" style={{ color: 'var(--icon-dim)' }} />
                            <span>Account</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => clerk.signOut({ redirectUrl: '/' })}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-rose-500/10"
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: 'var(--danger-text)',
                            }}
                            title="Sign Out"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* Subscription Plan & Expiry Date Row */}
                <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border text-xs"
                    style={{
                        background: 'var(--btn-surface)',
                        borderColor: 'var(--btn-border)',
                    }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <CreditCard className="w-4 h-4 shrink-0 text-[var(--icon-dim)]" />
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-[var(--text-main)] truncate">{subInfo.name}</span>
                            <span
                                className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full tracking-wider shrink-0"
                                style={{
                                    background: subInfo.badgeBg,
                                    color: subInfo.badgeText,
                                }}
                            >
                                {subInfo.badge}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--icon-dim)' }} />
                            <span>{subInfo.expiryLabel}</span>
                        </div>
                        <Link
                            href="/billing"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-main)] hover:underline transition-colors"
                        >
                            <span>Billing</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </Link>
                    </div>
                </div>

                {/* Research Personalization Row */}
                <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border text-xs"
                    style={{
                        background: 'var(--btn-surface)',
                        borderColor: 'var(--btn-border)',
                    }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
                        <div className="flex items-center gap-2 truncate">
                            <span className="text-[var(--text-dim)]">Research Field:</span>
                            <span className="font-semibold text-[var(--text-main)] truncate">
                                {user?.career_field ? getFieldById(user.career_field).label : 'Not personalized yet'}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-personalization'))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/20 transition-all shrink-0 self-start sm:self-auto"
                    >
                        <span>Change Field</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
