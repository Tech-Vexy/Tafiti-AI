// @ts-nocheck
import React, { useState } from 'react';
import { CreditCard, ShieldCheck, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/app/api/client';

export const BillingView = ({ user }) => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // ── Derived database-backed subscription & trial state ───────────────────
    const isActive = user?.subscription_status === 'active';
    const hasTrial = Boolean(user?.trial_ends_at);
    
    // Check expiration against database trial_ends_at or explicit status
    const isTrialExpired = !isActive && (
        user?.subscription_status === 'expired' ||
        (hasTrial && new Date(user.trial_ends_at).getTime() < Date.now())
    );

    // Days left calculated directly from database trial_ends_at
    const daysLeft = hasTrial
        ? Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    // Trial progress strictly from database created_at and trial_ends_at
    const getTrialProgress = () => {
        if (!user?.created_at || !user?.trial_ends_at) return 0;
        const start = new Date(user.created_at).getTime();
        const end = new Date(user.trial_ends_at).getTime();
        const now = Date.now();

        const totalDuration = end - start;
        const elapsed = now - start;

        if (totalDuration <= 0) return 100;
        return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    };

    const trialProgress = getTrialProgress();

    const handleSubscribe = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const { data } = await api.post('/billing/initialize');
            if (data?.authorization_url) {
                // Redirect to Paystack
                window.location.href = data.authorization_url;
            } else {
                setMessage({ type: 'error', text: 'Failed to initialize payment. Please try again.' });
            }
        } catch (err) {
            console.error('Subscription error:', err);
            setMessage({ type: 'error', text: 'Could not connect to payment gateway.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 py-10 px-4">
            <div className="text-center space-y-3">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight dark:text-[#FDFBFA] text-[#3A3D45]">
                    Advance Your Research
                </h2>
                <p className="dark:text-[#8A8884] text-[#3A3D45]/80 max-w-xl mx-auto font-normal text-sm sm:text-base leading-relaxed">
                    Unlock unlimited synthesis, advanced AI citations, and deep multi-source research tools.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Subscription Status Card */}
                <div className="p-7 sm:p-8 rounded-2xl border dark:border-[#383B43] border-[#8A8884]/25 dark:bg-[#1E1D1C] bg-[#FDFAF9] flex flex-col justify-between transition-all">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider dark:text-[#8A8884] text-[#3A3D45]/70">
                                Current Status
                            </span>
                            {isActive ? (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-semibold">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Active Pro
                                </span>
                            ) : isTrialExpired ? (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full text-[11px] font-semibold">
                                    <Clock className="w-3.5 h-3.5" /> Trial Expired
                                </span>
                            ) : hasTrial ? (
                                <span className="flex items-center gap-1.5 px-3 py-1 dark:bg-[#383B43] bg-stone-200 dark:text-[#FDFBFA] text-[#3A3D45] border dark:border-[#383B43] border-[#8A8884]/30 rounded-full text-[11px] font-semibold">
                                    <Clock className="w-3.5 h-3.5" /> Free Trial ({daysLeft}d left)
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 px-3 py-1 dark:bg-[#383B43] bg-stone-200 dark:text-[#FDFBFA] text-[#3A3D45] border dark:border-[#383B43] border-[#8A8884]/30 rounded-full text-[11px] font-semibold">
                                    <Clock className="w-3.5 h-3.5" /> Inactive
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold dark:text-[#FDFBFA] text-[#3A3D45]">
                                {isActive ? 'Pro Researcher' : isTrialExpired ? 'Trial Expired' : hasTrial ? 'Free Trial' : 'No Active Plan'}
                            </h3>
                            <p className="dark:text-[#8A8884] text-[#3A3D45]/80 text-sm font-normal leading-relaxed">
                                {isActive
                                    ? `Your subscription is active until ${new Date(user.subscription_ends_at).toLocaleDateString()}.`
                                    : isTrialExpired
                                        ? `Your trial expired on ${new Date(user.trial_ends_at).toLocaleDateString()}. Subscribe to continue full research access.`
                                        : hasTrial
                                            ? `You have ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining in your trial (expires ${new Date(user.trial_ends_at).toLocaleDateString()}).`
                                            : 'No trial or subscription is active. Subscribe to unlock deep synthesis.'}
                            </p>
                        </div>

                        {!isActive && hasTrial && (
                            <div className="p-4 dark:bg-[#171616] bg-[#FDFBFA] rounded-xl border dark:border-[#383B43] border-[#8A8884]/20 space-y-3">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className="dark:text-[#8A8884] text-[#3A3D45]/70">Trial Progress</span>
                                    <span className="dark:text-[#FDFBFA] text-[#3A3D45]">{isTrialExpired ? 100 : trialProgress}%</span>
                                </div>
                                <div className="h-1.5 w-full dark:bg-[#383B43] bg-stone-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full dark:bg-[#FDFBFA] bg-[#3A3D45] transition-all duration-1000"
                                        style={{ width: `${isTrialExpired ? 100 : trialProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isActive && (
                        <div className="mt-8 pt-6 border-t dark:border-[#383B43] border-[#8A8884]/20">
                            <button
                                onClick={handleSubscribe}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2.5 dark:bg-[#FDFBFA] bg-[#3A3D45] hover:opacity-90 disabled:opacity-50 dark:text-[#171616] text-[#FDFBFA] py-3.5 px-5 rounded-xl font-bold text-sm sm:text-base active:scale-[0.99] transition-all"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                <span>Subscribe for 200 KES</span>
                            </button>
                            <p className="mt-3 text-center text-[11px] dark:text-[#8A8884] text-[#3A3D45]/60 font-medium tracking-wide">
                                Secure payments via Paystack
                            </p>
                        </div>
                    )}
                </div>

                {/* Plan Benefits */}
                <div className="space-y-4">
                    <div className="p-5 rounded-2xl border dark:border-[#383B43] border-[#8A8884]/25 dark:bg-[#1E1D1C] bg-[#FDFAF9] space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="w-9 h-9 dark:bg-[#383B43] bg-stone-200 rounded-xl flex items-center justify-center dark:text-[#FDFBFA] text-[#3A3D45] shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold dark:text-[#FDFBFA] text-[#3A3D45] mb-0.5">Unlimited Synthesis</h4>
                                <p className="text-xs dark:text-[#8A8884] text-[#3A3D45]/75 leading-relaxed">Generate as many deep academic syntheses as your research demands without limits.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl border dark:border-[#383B43] border-[#8A8884]/25 dark:bg-[#1E1D1C] bg-[#FDFAF9] space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="w-9 h-9 dark:bg-[#383B43] bg-stone-200 rounded-xl flex items-center justify-center dark:text-[#FDFBFA] text-[#3A3D45] shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold dark:text-[#FDFBFA] text-[#3A3D45] mb-0.5">Advanced Citations</h4>
                                <p className="text-xs dark:text-[#8A8884] text-[#3A3D45]/75 leading-relaxed">Automated [Ref N] citation notation mapped to a full verified bibliography for every session.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl border dark:border-[#383B43] border-[#8A8884]/25 dark:bg-[#1E1D1C] bg-[#FDFAF9] space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="w-9 h-9 dark:bg-[#383B43] bg-stone-200 rounded-xl flex items-center justify-center dark:text-[#FDFBFA] text-[#3A3D45] shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold dark:text-[#FDFBFA] text-[#3A3D45] mb-0.5">Deep Web & Academic Search</h4>
                                <p className="text-xs dark:text-[#8A8884] text-[#3A3D45]/75 leading-relaxed">Multi-query autonomous web search, arXiv, Semantic Scholar, and domain-targeted extraction.</p>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span className="text-xs font-semibold">{message.text}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center pt-4">
                <p className="text-xs dark:text-[#8A8884] text-[#3A3D45]/60 font-medium">Cancel anytime • No hidden fees • Premium support</p>
            </div>
        </div>
    );
};

export default BillingView;
