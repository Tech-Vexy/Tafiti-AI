import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Send, Award, Loader2, ExternalLink } from 'lucide-react';
import api from '../api/client';

const EMPTY = { paper_title: '', description: '', amount_kes: 0, reputation_points: 10, expires_days: 14 };

export function BountiesView() {
    const [bounties, setBounties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [reviewTexts, setReviewTexts] = useState({});
    const [error, setError] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/bounties/');
            setBounties(data);
        } catch (e) {
            setError('Failed to load bounties');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/bounties/', form);
            setShowCreate(false);
            setForm(EMPTY);
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to create bounty');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitReview = async (bountyId) => {
        const text = reviewTexts[bountyId] || '';
        if (text.length < 50) { setError('Review must be at least 50 characters'); return; }
        setSubmitting(true);
        try {
            await api.post('/bounties/submit', { bounty_id: bountyId, review_text: text });
            setReviewTexts(prev => ({ ...prev, [bountyId]: '' }));
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-reveal">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Micro-Bounties</h2>
                    <p className="text-sm text-slate-500 mt-1">Post and win bounties for academic peer review.</p>
                </div>
                <button
                    onClick={() => setShowCreate(v => !v)}
                    className="btn-primary px-5 py-2.5 flex items-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Post Bounty
                </button>
            </header>

            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {showCreate && (
                <form onSubmit={handleCreate} className="glass-card-heavy p-6 space-y-4 animate-slide-up">
                    <h3 className="text-lg font-bold text-white">New Bounty</h3>
                    <input
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
                        placeholder="Paper title"
                        value={form.paper_title}
                        onChange={e => setForm(f => ({ ...f, paper_title: e.target.value }))}
                    />
                    <textarea
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none resize-none"
                        placeholder="What kind of review are you looking for? (min 20 chars)"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Amount (KES)</label>
                            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" value={form.amount_kes} onChange={e => setForm(f => ({ ...f, amount_kes: +e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Rep Points</label>
                            <input type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" value={form.reputation_points} onChange={e => setForm(f => ({ ...f, reputation_points: +e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Expires (days)</label>
                            <input type="number" min={1} max={90} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none" value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: +e.target.value }))} />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={submitting} className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Post
                        </button>
                        <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
            ) : bounties.length === 0 ? (
                <div className="glass-card p-16 text-center text-slate-500">No open bounties yet. Be the first to post one!</div>
            ) : (
                <div className="space-y-4">
                    {bounties.map(b => (
                        <div key={b.id} className="glass-card-heavy p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-base font-bold text-white">{b.paper_title || 'Untitled Paper'}</h4>
                                    <p className="text-sm text-slate-400 mt-1">{b.description}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-lg font-black text-emerald-400">{b.amount_kes > 0 ? `${b.amount_kes} KES` : 'Rep Only'}</div>
                                    <div className="text-xs text-slate-500">+{b.reputation_points} rep pts</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>{b.submission_count} submission{b.submission_count !== 1 ? 's' : ''}</span>
                                {b.expires_at && <span>Expires {new Date(b.expires_at).toLocaleDateString()}</span>}
                            </div>
                            <div className="flex gap-2">
                                <textarea
                                    rows={2}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none resize-none"
                                    placeholder="Write your review (min 50 chars)…"
                                    value={reviewTexts[b.id] || ''}
                                    onChange={e => setReviewTexts(prev => ({ ...prev, [b.id]: e.target.value }))}
                                />
                                <button
                                    onClick={() => handleSubmitReview(b.id)}
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all"
                                    title="Submit review"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default BountiesView;
