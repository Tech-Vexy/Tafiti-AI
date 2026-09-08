'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';

export default function HistoryPage() {
    const router = useRouter();
    const { history, isHistoryLoading, fetchHistory } = useLibraryStore();

    React.useEffect(() => { fetchHistory(); }, []);

    return (
        <div className="space-y-8 sm:space-y-12 animate-reveal">
            <header>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-1 sm:mb-2">Research History</h2>
                <p className="text-sm sm:text-base text-slate-500 font-medium tracking-tight">Access your past syntheses and organized research data.</p>
            </header>
            <div className="grid grid-cols-1 gap-6">
                {isHistoryLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                    </div>
                ) : history.length > 0 ? (
                    history.map((item) => (
                        <div key={item.id} className="glass-card-heavy p-5 sm:p-8 space-y-4 hover:border-indigo-500/30 transition-all cursor-pointer group"
                            onClick={() => {
                                useResearchStore.setState({ synthesis: item.answer, lastQuery: item.query, papers: item.papers });
                                router.push('/');
                            }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <h3 className="font-black text-xl text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.title}</h3>
                                </div>
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">{item.answer}</p>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 pt-4 border-t border-white/5">
                                <span>{item.papers.length} Sources</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-slate-500 font-medium text-lg">Your research history is empty.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
