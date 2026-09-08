// @ts-nocheck
'use client';

import dynamic from 'next/dynamic';
import { useAuth, useUser } from '@clerk/nextjs';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import useUserStore from '@/store/useUserStore';
import { injectToken } from '@/api/client';
import { useEffect } from 'react';

const DiscoverView = dynamic(() => import('@/components/DiscoverView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function DiscoverViewPage() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const {
        recs, isFetchRecs, handleFetchRecommendations, handleSearch,
        discoverPapers, isLoadingDiscover, fetchDiscoverPapers,
    } = useResearchStore();
    const { userProfile } = useUserStore();
    const { handleSavePaper } = useLibraryStore();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    return (
        <DiscoverView
            user={user}
            recs={recs}
            isFetchRecs={isFetchRecs}
            onSearch={handleSearch}
            careerField={userProfile?.career_field}
            handleSavePaper={handleSavePaper}
            onFetchRecommendations={() => handleFetchRecommendations(getToken)}
            discoverPapers={discoverPapers}
            isLoadingDiscover={isLoadingDiscover}
            onRefreshDiscover={fetchDiscoverPapers}
        />
    );
}
