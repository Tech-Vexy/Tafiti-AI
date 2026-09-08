// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { PaperCard } from '@/components/PaperCard';
import { SkeletonPaperCard } from '@/components/ui/Skeleton';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import { useRouter } from 'next/navigation';
import { Bookmark, Rocket, Search, ArrowRight } from 'lucide-react';

export default function LibraryPage() {
    const router = useRouter();
    const { selectedPapers, togglePaper } = useResearchStore();
    const { library, fetchLibrary, handleSavePaper } = useLibraryStore();
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        fetchLibrary().finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="space-y-8 animate-reveal">
            <header className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-1 sm:mb-2">Personal Library</h2>
                    <p className="text-sm sm:text-base text-slate-500 font-medium">Manage your curated research repository.</p>
                </div>
                {library.length > 0 && (
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600 shrink-0">
                        {library.length} paper{library.length !== 1 ? 's' : ''}
                    </span>
                )}
            </header>
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonPaperCard key={i} />)}
                </div>
            ) : library.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {library.map((paper) => (
                        <PaperCard
                            key={paper.id}
                            paper={paper}
                            onSelect={togglePaper}
                            isSelected={!!selectedPapers.find(p => p.id === paper.id)}
                            onSave={handleSavePaper}
                            isSaved={true}
                        />
                    ))}
                </div>
            ) : (
                <div className="glass-card p-16 sm:p-24 text-center space-y-6 border-dashed border-white/5 bg-white/[0.01]">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl mx-auto flex items-center justify-center">
                        <Bookmark className="w-10 h-10 text-indigo-400/60" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-2xl font-black text-white/40 tracking-tight">Your library is empty</h3>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                            Search for papers and click the bookmark icon to save them here for quick access.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2 mx-auto"
                    >
                        <Search className="w-4 h-4" />
                        Start Searching
                    </button>
                </div>
            )}
        </div>
    );
}
