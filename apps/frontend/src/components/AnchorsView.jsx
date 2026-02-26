import React, { useState, useEffect } from 'react';
import { Shield, Hash, CheckCircle, Loader2, Plus } from 'lucide-react';
import api from '../api/client';

export function AnchorsView() {
    const [anchors, setAnchors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [label, setLabel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [verifyContent, setVerifyContent] = useState('');
    const [verifyHash, setVerifyHash] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/anchors/');
            setAnchors(data);
        } catch {
            setError('Failed to load anchors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleAnchor = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;
        setSubmitting(true);
        setError('');
        try {
            await api.post('/anchors/', { content, label: label || undefined });
            setContent('');
            setLabel('');
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to anchor draft');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setVerifyResult(null);
        try {
            const { data } = await api.post('/anchors/verify', { content: verifyContent, content_hash: verifyHash || undefined });
            setVerifyResult(data);
        } catch (e) {
            setError(e.response?.data?.detail || 'Verification failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-reveal">
            <header>
                <h2 className="text-3xl font-black tracking-tight text-white">Draft Anchoring</h2>
                <p className="text-sm text-slate-500 mt-1">Prove prior art by anchoring a cryptographic hash of your draft.</p>
            </header>

            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Anchor new draft */}
                <div className="glass-card-heavy p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Hash className="w-5 h-5 text-indigo-400" />
                        Anchor a Draft
                    </h3>
                    <form onSubmit={handleAnchor} className="space-y-3">
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
                            placeholder="Label (e.g. 'Malaria vaccine draft v1')"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                        />
                        <textarea
                            rows={6}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none resize-none"
                            placeholder="Paste your draft text here. Only the hash will be stored — content stays private."
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                        <button type="submit" disabled={submitting || !content.trim()} className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            Anchor
                        </button>
                    </form>
                </div>

                {/* Verify */}
                <div className="glass-card-heavy p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        Verify a Draft
                    </h3>
                    <form onSubmit={handleVerify} className="space-y-3">
                        <textarea
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none resize-none"
                            placeholder="Paste draft content to verify…"
                            value={verifyContent}
                            onChange={e => setVerifyContent(e.target.value)}
                        />
                        <input
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-indigo-500/50 outline-none"
                            placeholder="Or paste SHA-256 hash directly"
                            value={verifyHash}
                            onChange={e => setVerifyHash(e.target.value)}
                        />
                        <button type="submit" disabled={submitting || (!verifyContent && !verifyHash)} className="px-5 py-2 text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-2">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Verify
                        </button>
                    </form>
                    {verifyResult && (
                        <div className={`rounded-xl p-4 text-sm font-medium ${verifyResult.match ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {verifyResult.match
                                ? `✓ Match confirmed. Anchored on ${new Date(verifyResult.anchored_at).toLocaleString()}`
                                : '✗ No matching anchor found for this content.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Anchors list */}
            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Your Anchors</h3>
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
                ) : anchors.length === 0 ? (
                    <div className="glass-card p-12 text-center text-slate-500">No anchors yet.</div>
                ) : (
                    <div className="space-y-3">
                        {anchors.map(a => (
                            <div key={a.id} className="glass-card p-4 flex items-center gap-4">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                    <Shield className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-white truncate">{a.label || 'Unlabeled draft'}</div>
                                    <div className="text-xs font-mono text-slate-500 truncate">{a.content_hash}</div>
                                </div>
                                <span className="text-xs text-slate-500 shrink-0">{new Date(a.anchored_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AnchorsView;
