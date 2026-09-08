'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import useUserStore from '@/store/useUserStore';
import useUIStore from '@/store/useUIStore';
import { injectToken } from '@/api/client';
import { useEffect } from 'react';

const FeedView = dynamic(() => import('@/components/FeedView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function FeedViewPage() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const searchBoxRef = useRef(null);

    const {
        papers, selectedPapers, lastQuery, isLoading, synthesis, synthesisLanguage,
        outputLanguage, setOutputLanguage, isSynthesizing, followupQuestions,
        paperImpacts, isImpactLoading, handleSearch, togglePaper,
        handleSynthesize, handleGetPaperImpact, handleFetchRecommendations,
        recs, isFetchRecs, showPreferenceForm, setShowPreferenceForm,
    } = useResearchStore();

    const {
        library, history, isHistoryLoading, handleSavePaper,
        handleClipPaper, handleClipSynthesis,
    } = useLibraryStore();

    const { userProfile, getTrialState, handleStartTrial } = useUserStore();
    const { setActiveTab } = useUIStore();
    const trialState = getTrialState();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    return (
        <FeedView
            searchBoxRef={searchBoxRef}
            papers={papers}
            selectedPapers={selectedPapers}
            library={library}
            history={history}
            isLoading={isLoading}
            isHistoryLoading={isHistoryLoading}
            isSynthesizing={isSynthesizing}
            synthesis={synthesis}
            synthesisLanguage={synthesisLanguage}
            outputLanguage={outputLanguage}
            setOutputLanguage={setOutputLanguage}
            lastQuery={lastQuery}
            followupQuestions={followupQuestions}
            paperImpacts={paperImpacts}
            isImpactLoading={isImpactLoading}
            isPremiumBlocked={trialState?.isPremiumBlocked}
            isStartingTrial={false}
            trialNotStarted={trialState?.trialNotStarted}
            showPreferenceForm={showPreferenceForm}
            setShowPreferenceForm={setShowPreferenceForm}
            isFetchRecs={isFetchRecs}
            onSearch={handleSearch}
            onSynthesize={() => handleSynthesize(getToken, false)}
            onTogglePaper={togglePaper}
            onSavePaper={handleSavePaper}
            onClipPaper={handleClipPaper}
            onImpact={(p) => handleGetPaperImpact(p, getToken)}
            onGraph={() => {}}
            onClipSynthesis={handleClipSynthesis}
            onFetchRecommendations={() => handleFetchRecommendations(getToken)}
            onRestoreHistory={() => {}}
            onNavigateHistory={() => {}}
            handleStartTrial={handleStartTrial}
            setActiveTab={setActiveTab}
        />
    );
}
