import React, { useState, useEffect } from 'react';
import { Building2, Plus, LogIn, Users, Copy, Loader2 } from 'lucide-react';
import api from '../api/client';

const CREATE_EMPTY = { name: '', institution: '', description: '', is_public: false, expires_days: '' };

export function SandboxesView() {
    const [sandboxes, setSandboxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [form, setForm] = useState(CREATE_EMPTY);
    const [joinCode, setJoinCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState('');

    const load = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/sandboxes/');
            setSandboxes(data);
        } catch {
            setError('Failed to load sandboxes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await api.post('/sandboxes/', {
                name: form.name,
                institution: form.institution,
                description: form.description || undefined,
                is_public: form.is_public,
            });
            setShowCreate(false);
            setForm(CREATE_EMPTY);
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to create sandbox');
        } finally {
            setSubmitting(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await api.post('/sandboxes/join', { invite_code: joinCode.toUpperCase() });
            setShowJoin(false);
            setJoinCode('');
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to join sandbox');
        } finally {
            setSubmitting(false);
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(code);
            setTimeout(() => setCopied(''), 2000);
        });
    };

    return (
        <div className="space-y-8 animate-reveal">
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Institutional Sandboxes</h2>
                    <p className="text-sm text-slate-500 mt-1">Private, branded research workspaces for universities and events.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setShowJoin(v => !v); setShowCreate(false); }} className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:border-indigo-500/30 hover:text-white transition-all flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        Join with Code
                    </button>
                    <button onClick={() => { setShowCreate(v => !v); setShowJoin(false); }} className="btn-primary px-5 py-2.5 flex items-center gap-2 text-sm">
                        <Plus className="w-4 h-4" />
                        Create Sandbox
                    </button>
                </div>
            </header>

            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {showJoin && (
                <form onSubmit={handleJoin} className="glass-card-heavy p-6 space-y-4 animate-slide-up">
                    <h3 className="text-lg font-bold text-white">Join a Sandbox</h3>
                    <input
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white uppercase tracking-widest focus:border-indigo-500/50 outline-none"
                        placeholder="Enter invite code (e.g. XK72B9A1)"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={8}
                    />
                    <div className="flex gap-3">
                        <button type="submit" disabled={submitting || joinCode.length < 6} className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Join
                        </button>
                        <button type="button" onClick={() => setShowJoin(false)} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                </form>
            )}

            {showCreate && (
                <form onSubmit={handleCreate} className="glass-card-heavy p-6 space-y-4 animate-slide-up">
                    <h3 className="text-lg font-bold text-white">New Sandbox</h3>
                    <input required minLength={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none" placeholder="Sandbox name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    <input required minLength={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none" placeholder="Institution (e.g. University of Nairobi)" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
                    <textarea rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none resize-none" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="w-4 h-4 accent-indigo-500" />
                        <span className="text-sm text-slate-300">Make publicly discoverable</span>
                    </label>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={submitting} className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create
                        </button>
                        <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
            ) : sandboxes.length === 0 ? (
                <div className="glass-card p-16 text-center text-slate-500">You haven't joined any sandboxes yet.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sandboxes.map(sb => (
                        <div key={sb.id} className="glass-card-heavy p-6 space-y-4 hover:border-indigo-500/20 transition-all">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-base font-bold text-white">{sb.name}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{sb.institution}</p>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-xs text-slate-500">{sb.member_count}</span>
                                </div>
                            </div>
                            {sb.description && <p className="text-sm text-slate-400">{sb.description}</p>}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className="text-xs text-slate-500 font-mono tracking-widest">{sb.invite_code}</span>
                                <button
                                    onClick={() => copyCode(sb.invite_code)}
                                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    {copied === sb.invite_code ? 'Copied!' : 'Copy Code'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SandboxesView;
