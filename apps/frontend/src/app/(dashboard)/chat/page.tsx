'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import { injectToken } from '@/api/client';
import { useEffect } from 'react';

const ResearchChatView = dynamic(() => import('@/components/ResearchChatView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function ResearchChatViewPage() {
    const { getToken } = useAuth();
    const {
        selectedPapers, messages, isChatLoading, isCollaborative, setIsCollaborative,
        followupQuestions, handleResearchChat,
    } = useResearchStore();
    const {
        uploadedFiles, isUploading, handleUploadFile, handleRemoveUpload,
    } = useLibraryStore();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    const onSendMessage = (text, sources) => handleResearchChat(text, getToken, sources);
    const onUploadFile = (file) => handleUploadFile(file, getToken);

    return (
        <ResearchChatView
            savedPapers={selectedPapers}
            onSendMessage={onSendMessage}
            onUploadFile={onUploadFile}
            isUploading={isUploading}
            uploadedFiles={uploadedFiles}
            onRemoveUpload={handleRemoveUpload}
            isLoading={isChatLoading}
            messages={messages}
            isCollaborative={isCollaborative}
            setIsCollaborative={setIsCollaborative}
            followupQuestions={followupQuestions}
        />
    );
}
