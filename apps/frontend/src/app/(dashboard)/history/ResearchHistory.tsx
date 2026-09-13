// @ts-nocheck
'use client';

import React from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';

export default function ResearchHistory() {
    const router = useRouter();
    const { history, isHistoryLoading, fetchHistory } = useLibraryStore();
    const deleteChatSession = useResearchStore((s) => s.deleteChatSession);

    React.useEffect(() => {
        fetchHistory(true);

        const onFocus = () => fetchHistory(true);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchHistory]);

    const sortedHistory = React.useMemo(() => {
        return [...history].sort((a, b) => {
            const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
            const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
            return timeB - timeA;
        });
    }, [history]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await deleteChatSession(id);
    };

    return (
        <div className="space-y-8 sm:space-y-12 animate-reveal">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text-main)] mb-1 sm:mb-2">Research History</h2>
                    <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium tracking-tight">Access your past syntheses and organized research data in real-time.</p>
                </div>
            </header>
            <div className="grid grid-cols-1 gap-6">
                {isHistoryLoading && history.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
                    </div>
                ) : sortedHistory.length > 0 ? (
                    sortedHistory.map((item) => (
                        <div key={item.id} className="glass-card-heavy p-5 sm:p-8 space-y-4 hover:border-sky-500/30 transition-all cursor-pointer group relative"
                            onClick={() => {
                                useResearchStore.getState().loadChatSession(item);
                                router.push('/research');
                            }}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-sky-400" />
                                    </div>
                                    <h3 className="font-black text-xl text-[var(--text-main)] group-hover:text-sky-400 transition-colors uppercase tracking-tight truncate">{item.title || item.query}</h3>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {item.isLive ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                                            </span>
                                            Live Research
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</span>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(e, item.id)}
                                        title="Delete research"
                                        aria-label={`Delete ${item.title || item.query}`}
                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition-all text-slate-400 hover:text-rose-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[var(--text-dim)] line-clamp-2 text-sm leading-relaxed">{item.answer || (item.isLive ? 'Researching and extracting academic evidence in real-time...' : 'No answer content recorded.')}</p>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] pt-4 border-t border-[var(--border-glass)]">
                                <span>{(item.papers || []).length} Sources</span>
                                {item.tags && item.tags.length > 0 && (
                                    <span>• {item.tags.join(', ')}</span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-[var(--text-muted)] font-medium text-lg">Your research history is empty.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

