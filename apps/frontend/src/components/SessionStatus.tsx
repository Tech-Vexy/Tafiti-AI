// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Loader2, AlertTriangle, Shield, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/app/api/client';

const SessionStatus = ({ questionId }) => {
    const [session, setSession] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [checkpoints, setCheckpoints] = useState([]);
    const [showAudit, setShowAudit] = useState(false);
    const [showCheckpoints, setShowCheckpoints] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    const fetchSession = useCallback(async () => {
        if (!questionId) return;
        try {
            const { data } = await api.get(`/intelligence/questions/${questionId}/session`);
            setSession(data);
            setError(null);
        } catch (e) {
            if (e.response?.status !== 404) {
                setError('Failed to load session');
            }
        }
    }, [questionId]);

    const fetchAuditLog = useCallback(async () => {
        if (!questionId) return;
        try {
            const { data } = await api.get(`/intelligence/questions/${questionId}/audit-log`);
            setAuditLog(Array.isArray(data) ? data : data.entries || []);
        } catch (e) {
            console.error('Failed to fetch audit log', e);
        }
    }, [questionId]);

    const fetchCheckpoints = useCallback(async () => {
        if (!questionId) return;
        try {
            const { data } = await api.get(`/intelligence/questions/${questionId}/checkpoints`);
            setCheckpoints(Array.isArray(data) ? data : data.checkpoints || []);
        } catch (e) {
            console.error('Failed to fetch checkpoints', e);
        }
    }, [questionId]);

    useEffect(() => {
        fetchSession();
        const interval = setInterval(fetchSession, 3000);
        return () => clearInterval(interval);
    }, [fetchSession]);

    const startResearch = async () => {
        setActionLoading('start');
        try {
            await api.post(`/intelligence/questions/${questionId}/start-async`);
            await fetchSession();
        } catch (e) {
            setError('Failed to start research');
        } finally {
            setActionLoading(null);
        }
    };

    const pauseResearch = async () => {
        setActionLoading('pause');
        try {
            await api.post(`/intelligence/questions/${questionId}/pause`);
            await fetchSession();
        } catch (e) {
            setError('Failed to pause research');
        } finally {
            setActionLoading(null);
        }
    };

    const resumeResearch = async () => {
        setActionLoading('resume');
        try {
            await api.post(`/intelligence/questions/${questionId}/resume`);
            await fetchSession();
        } catch (e) {
            setError('Failed to resume research');
        } finally {
            setActionLoading(null);
        }
    };

    if (!session && !error) {
        return (
            <div className="glass-card p-4 text-center">
                <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading session...</p>
            </div>
        );
    }

    if (error && !session) {
        return (
            <div className="glass-card p-4">
                <p className="text-xs text-slate-500 text-center mb-3">No active session</p>
                <button onClick={startResearch} disabled={actionLoading === 'start'}
                    className="w-full px-3 py-2 text-xs flex items-center justify-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-50">
                    {actionLoading === 'start' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Start Research
                </button>
            </div>
        );
    }

    const progress = session.total_tasks > 0
        ? Math.round((session.completed_tasks / session.total_tasks) * 100)
        : 0;

    return (
        <div className="glass-card p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${session.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">{session.status}</span>
                </div>
                <div className="flex items-center gap-1">
                    {session.is_running && (
                        <button onClick={pauseResearch} disabled={actionLoading === 'pause'}
                            className="px-3 py-2 text-xs flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                            {actionLoading === 'pause' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                            Pause
                        </button>
                    )}
                    {!session.is_running && session.status !== 'completed' && session.status !== 'failed' && (
                        <button onClick={session.completed_tasks > 0 ? resumeResearch : startResearch}
                            disabled={actionLoading === 'resume' || actionLoading === 'start'}
                            className="px-3 py-2 text-xs flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                            {actionLoading === 'resume' || actionLoading === 'start' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            {session.completed_tasks > 0 ? 'Resume' : 'Start'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {session.total_tasks > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{session.completed_tasks}/{session.total_tasks} tasks completed</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: 'Ready', value: session.ready_tasks || 0, icon: Play, color: 'emerald' },
                    { label: 'Running', value: session.running_tasks || 0, icon: Loader2, color: 'amber' },
                    { label: 'Blocked', value: session.blocked_tasks || 0, icon: AlertTriangle, color: 'red' },
                    { label: 'Checkpoints', value: session.checkpoints || 0, icon: Shield, color: 'teal' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="p-2 bg-white/[0.02] rounded-lg text-center">
                        <Icon className={`w-3 h-3 mx-auto mb-1 text-${color}-400`} />
                        <p className={`text-sm font-bold text-${color}-400`}>{value}</p>
                        <p className="text-[9px] text-slate-500 uppercase">{label}</p>
                    </div>
                ))}
            </div>

            {/* Agents */}
            {session.agent_count > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>{session.active_agents || 0}/{session.agent_count} agents active</span>
                </div>
            )}

            {/* Error */}
            {session.last_error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                    {session.last_error}
                </div>
            )}

            {/* Audit Log Toggle */}
            <button
                onClick={() => { setShowAudit(!showAudit); if (!showAudit) fetchAuditLog(); }}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-[var(--text-main)] transition-colors"
            >
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Audit Trail</span>
                {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showAudit && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {auditLog.length === 0 ? (
                        <p className="text-[10px] text-slate-600 text-center py-2">No transitions recorded</p>
                    ) : (
                        auditLog.slice(0, 10).map((entry, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                <span className="text-[var(--text-main)]">{entry.from_status}</span>
                                <span className="text-sky-400">{'>'}</span>
                                <span className="text-[var(--text-main)]">{entry.to_status}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Checkpoints Toggle */}
            <button
                onClick={() => { setShowCheckpoints(!showCheckpoints); if (!showCheckpoints) fetchCheckpoints(); }}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-[var(--text-main)] transition-colors"
            >
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Snapshots</span>
                {showCheckpoints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showCheckpoints && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {checkpoints.length === 0 ? (
                        <p className="text-[10px] text-slate-600 text-center py-2">No checkpoints</p>
                    ) : (
                        checkpoints.map((cp) => (
                            <div key={cp.id} className="flex items-center justify-between text-[10px] text-slate-500 p-1.5 bg-white/[0.02] rounded">
                                <span>Tasks: {cp.tasks_completed}</span>
                                <span>{new Date(cp.created_at).toLocaleTimeString()}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SessionStatus;
