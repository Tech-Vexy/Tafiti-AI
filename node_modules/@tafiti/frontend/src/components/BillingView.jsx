import React, { useState, useEffect } from 'react';
import { CreditCard, Rocket, ShieldCheck, Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import api from '../api/client';

export const BillingView = ({ user }) => {
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState(null);

    // ── Derived subscription state ──────────────────────────────────────────
    const isActive = user?.subscription_status === 'active';
    const isTrialExpired = !isActive && user?.trial_ends_at
        ? new Date(user.trial_ends_at) < new Date()
        : false;
    const daysLeft = user?.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(user.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 14; // default 14-day trial if not set yet

    // Calculate total trial duration and progress percentage
    const getTrialProgress = () => {
        if (!user.created_at || !user.trial_ends_at) return 0;
        const start = new Date(user.created_at);
        const end = new Date(user.trial_ends_at);
        const now = new Date();

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
        <div className="max-w-4xl mx-auto space-y-12 animate-fade-in py-10">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
                    <Rocket className="w-4 h-4" />
                    Premium Research Experience
                </div>
                <h2 className="text-5xl font-black tracking-tight text-white italic">Advance Your Discovery</h2>
                <p className="text-slate-400 max-w-xl mx-auto font-medium">Unlock unlimited synthesis, advanced AI citations, and real-time collaboration tools.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Subscription Status Card */}
                <div className="glass-card-heavy p-8 border-white/5 flex flex-col justify-between group hover:border-indigo-500/30 transition-all duration-500">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Current Status</span>
                            {isActive ? (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <ShieldCheck className="w-3 h-3" /> Pro Active
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <Clock className="w-3 h-3" /> {isTrialExpired ? 'Trial Expired' : 'Free Trial'}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white capitalize">
                                {isActive ? 'Premium Scholar' : 'Early Access Trial'}
                            </h3>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                {isActive
                                    ? `Your subscription is active until ${new Date(user.subscription_ends_at).toLocaleDateString()}.`
                                    : isTrialExpired
                                        ? 'Your free trial has concluded. Subscribe to regain full access to synthesis tools.'
                                        : `You have ${daysLeft} days remaining in your premium free trial period.`}
                            </p>
                        </div>

                        {!isActive && (
                            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-400">Trial Progress</span>
                                    <span className="text-indigo-400">{isTrialExpired ? 100 : trialProgress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-1000"
                                        style={{ width: `${isTrialExpired ? 100 : trialProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {!isActive && (
                        <div className="mt-10 pt-8 border-t border-white/5">
                            <button
                                onClick={handleSubscribe}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-5 rounded-2xl font-black text-lg shadow-2xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
                                Subscribe for 200 KES
                            </button>
                            <p className="mt-4 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">SECURE PAYMENTS BY PAYSTACK</p>
                        </div>
                    )}
                </div>

                {/* Plan Benefits */}
                <div className="space-y-6">
                    <div className="glass-card p-6 border-white/5 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Unlimited Synthesis</h4>
                                <p className="text-xs text-slate-400 font-medium leading-[1.6]">Generate as many academic syntheses as your research demands without limits.</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-white/5 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Advanced Citations</h4>
                                <p className="text-xs text-slate-400 font-medium leading-[1.6]">Automated [Ref N] notation mapped to a full bibliography for every session.</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-white/5 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Network Discovery</h4>
                                <p className="text-xs text-slate-400 font-medium leading-[1.6]">Unlock the ability to discover and connect with scholars in your specific field.</p>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            <span className="text-xs font-bold">{message.text}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center pt-8 opacity-40 hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Cancel anytime • No hidden fees • Premium support</p>
            </div>
        </div>
    );
};
