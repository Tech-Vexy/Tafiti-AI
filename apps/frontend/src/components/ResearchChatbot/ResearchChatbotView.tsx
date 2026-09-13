// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import useUserStore from '@/store/useUserStore';
import ResearchPromptBox from './ResearchPromptBox';
import ConversationThread from './ConversationThread';
import GroundingDrawer from './GroundingDrawer';
import SourcesSidebar from './SourcesSidebar';
import { ResearchPaper } from './SourceCardsCarousel';
import { extractAndStripSources } from '@/lib/citationUtils';

export default function ResearchChatbotView({ initialQuery = '' }: { initialQuery?: string }) {
    const { user } = useUser();
    const [input, setInput] = useState(initialQuery);
    const [isGroundingOpen, setIsGroundingOpen] = useState(false);
    const [isSourcesRailOpen, setIsSourcesRailOpen] = useState(true);
    const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
    const [activeModalSources, setActiveModalSources] = useState<ResearchPaper[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isSendingRef = useRef(false);

    useEffect(() => {
        if (initialQuery && messages.length === 0) {
            setInput(initialQuery);
        }
    }, [initialQuery]);

    // Research Store state
    const {
        messages,
        isChatLoading,
        researchMode,
        setResearchMode,
        latencyMode,
        setLatencyMode,
        chatSources,
        setChatSources,
        papers,
        followupQuestions,
        activeChatTitle,
        activeChatId,
        handleResearchChat,
        retryResearchChat,
        domainScope,
        setDomainScope,
    } = useResearchStore();

    const prevChatIdRef = useRef(activeChatId);

    // Library Store state
    const {
        library,
        fetchLibrary,
        fetchHistory,
        uploadedFiles,
        isUploading,
        handleUploadFile,
        handleRemoveUpload,
        handleClipSynthesis,
        handleSavePaper,
    } = useLibraryStore();

    // Lazy-load library papers only when the grounding drawer is opened
    useEffect(() => {
        if (isGroundingOpen) {
            fetchLibrary();
        }
    }, [isGroundingOpen]);

    // When clicking or switching between chat sessions, scroll to TOP, never to bottom
    useEffect(() => {
        if (activeChatId !== prevChatIdRef.current) {
            prevChatIdRef.current = activeChatId;
            isSendingRef.current = false;
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [activeChatId]);

    // Auto-scroll to bottom ONLY when actively sending a query or streaming a response
    useEffect(() => {
        if (isSendingRef.current || isChatLoading) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isChatLoading]);

    // Reset sending state when loading completes
    useEffect(() => {
        if (!isChatLoading) {
            isSendingRef.current = false;
        }
    }, [isChatLoading]);

    const userInitials = user?.fullName
        ? user.fullName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
        : 'RE';

    // Current research sources from active selection or latest assistant message
    const currentSources: ResearchPaper[] = useMemo(() => {
        if (activeModalSources.length > 0) return activeModalSources;
        const assistantMsgs = [...messages].reverse().filter((m) => m.role === 'assistant');
        for (const m of assistantMsgs) {
            const rawSources = m.sources || [];
            const { sources } = extractAndStripSources(m.content || '', rawSources);
            if (sources && sources.length > 0) {
                return sources;
            }
        }
        if (chatSources && chatSources.length > 0) return chatSources;
        if (papers && papers.length > 0) return papers;
        return [];
    }, [messages, activeModalSources, chatSources, papers]);

    // First user query for title
    const userQueryTitle = useMemo(() => {
        const firstUser = messages.find((m) => m.role === 'user');
        return activeChatTitle || firstUser?.content || 'Research Investigation';
    }, [messages, activeChatTitle]);

    const handleSendMessage = async (queryText: string) => {
        if (!queryText.trim() || isChatLoading) return;
        const text = queryText;
        setInput('');
        isSendingRef.current = true;
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

        // Send research query with grounding sources
        await handleResearchChat(text, [], uploadedFiles);

        // Refresh history so sidebar updates immediately
        fetchHistory();
    };

    const handleRetry = async (errorIndex: number) => {
        if (isChatLoading) return;
        await retryResearchChat(errorIndex);
        fetchHistory();
    };

    const handleTogglePaperGround = (paper: ResearchPaper) => {
        const id = paper.paper_id || paper.id;
        const exists = chatSources.some((p: any) => (p.paper_id || p.id) === id);
        if (exists) {
            setChatSources(chatSources.filter((p: any) => (p.paper_id || p.id) !== id));
        } else {
            setChatSources([...chatSources, paper]);
        }
    };

    const handleRemovePaperGround = (paper: ResearchPaper) => {
        const id = paper.paper_id || paper.id;
        setChatSources(chatSources.filter((p: any) => (p.paper_id || p.id) !== id));
    };

    const handleClipNotes = (content: string, sources: ResearchPaper[]) => {
        handleClipSynthesis(content, sources, userQueryTitle);
    };

    const handleOpenSources = (sourcesList?: ResearchPaper[]) => {
        if (sourcesList && sourcesList.length > 0) {
            setActiveModalSources(sourcesList);
        }
        setIsSourcesRailOpen(true);
        setIsSourcesCollapsed(false);
    };

    const isThreadActive = messages.length > 0;
    const userProfile = useUserStore((s) => s.userProfile);
    const activeFieldId = domainScope || userProfile?.career_field || 'all';

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-main)]">
            {/* ── MINIMALIST HOME STATE (Nothing but the input area) ── */}
            {!isThreadActive ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16 pt-8 animate-fade-in overflow-y-auto custom-scrollbar">
                    <div className="w-full max-w-2xl lg:max-w-3xl mx-auto">
                        {/* Centered Minimal Input Box */}
                        <ResearchPromptBox
                            input={input}
                            setInput={setInput}
                            onSend={handleSendMessage}
                            isLoading={isChatLoading}
                            researchMode={researchMode}
                            setResearchMode={setResearchMode}
                            latencyMode={latencyMode}
                            setLatencyMode={setLatencyMode}
                            uploadedFiles={uploadedFiles}
                            onRemoveUpload={handleRemoveUpload}
                            onOpenGroundingDrawer={() => setIsGroundingOpen(true)}
                            selectedField={activeFieldId}
                            onSelectField={setDomainScope}
                        />
                    </div>
                </div>
            ) : (
                /* ── ACTIVE RESEARCH THREAD ── */
                <div className="flex-1 min-w-0 flex overflow-hidden">
                    {/* Center Column: Message thread scrolls independently, input stays fixed at bottom */}
                    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
                        {/* Scrollable conversation history */}
                        <div ref={scrollContainerRef} className="flex-1 min-w-0 overflow-y-auto custom-scrollbar no-scrollbar scrollbar-none">
                            <div className="w-full max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-6 space-y-6 min-w-0">
                                <ConversationThread
                                    messages={messages}
                                    isLoading={isChatLoading}
                                    followupQuestions={followupQuestions}
                                    onSelectFollowup={handleSendMessage}
                                    onRetry={handleRetry}
                                    onClipNotes={handleClipNotes}
                                    onSaveToLibrary={handleSavePaper}
                                    onOpenSources={handleOpenSources}
                                    userInitials={userInitials}
                                />
                                <div ref={bottomRef} className="h-2" />
                            </div>
                        </div>

                        {/* Fixed bottom input container: does NOT move with text, sits tightly at bottom */}
                        <div className="shrink-0 w-full px-4 pt-1 pb-3 sm:pb-3.5 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent">
                            <div className="w-full max-w-3xl lg:max-w-4xl mx-auto min-w-0">
                                <ResearchPromptBox
                                    input={input}
                                    setInput={setInput}
                                    onSend={handleSendMessage}
                                    isLoading={isChatLoading}
                                    researchMode={researchMode}
                                    setResearchMode={setResearchMode}
                                    latencyMode={latencyMode}
                                    setLatencyMode={setLatencyMode}
                                    uploadedFiles={uploadedFiles}
                                    onRemoveUpload={handleRemoveUpload}
                                    onOpenGroundingDrawer={() => setIsGroundingOpen(true)}
                                    isCompact={true}
                                    selectedField={activeFieldId}
                                    onSelectField={setDomainScope}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Responsive Sources Sidebar & Controller ── */}
                    {isSourcesRailOpen && currentSources.length > 0 && (
                        <>
                            {/* Desktop (>= lg): Dedicated invisible sidebar column with floating card */}
                            <div className="hidden lg:flex flex-col shrink-0 w-[340px] xl:w-[380px] p-4 pr-6 overflow-hidden select-none pointer-events-auto">
                                <SourcesSidebar
                                    sources={currentSources}
                                    isLoading={isChatLoading && currentSources.length === 0}
                                    isCollapsed={isSourcesCollapsed}
                                    onToggleCollapse={() => setIsSourcesCollapsed((prev) => !prev)}
                                    onSaveToLibrary={handleSavePaper}
                                />
                            </div>

                            {/* Mobile/Tablet (< lg): Floating minimized pill so sources NEVER disappear on screen resize */}
                            {isSourcesCollapsed && (
                                <div className="lg:hidden fixed top-3 right-4 z-40 max-w-[280px] shadow-2xl animate-fade-in pointer-events-auto">
                                    <SourcesSidebar
                                        sources={currentSources}
                                        isLoading={isChatLoading && currentSources.length === 0}
                                        isCollapsed={true}
                                        onToggleCollapse={() => setIsSourcesCollapsed(false)}
                                        onSaveToLibrary={handleSavePaper}
                                    />
                                </div>
                            )}

                            {/* Mobile/Tablet (< lg): Sliding panel overlay when user opens/expands sources */}
                            {!isSourcesCollapsed && (
                                <div
                                    className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in p-3"
                                    onClick={() => setIsSourcesCollapsed(true)}
                                >
                                    <div
                                        className="w-full max-w-sm h-full flex flex-col pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <SourcesSidebar
                                            sources={currentSources}
                                            isLoading={isChatLoading && currentSources.length === 0}
                                            isCollapsed={false}
                                            onToggleCollapse={() => setIsSourcesCollapsed(true)}
                                            onSaveToLibrary={handleSavePaper}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Grounding Drawer for attaching papers or uploading PDFs */}
            <GroundingDrawer
                isOpen={isGroundingOpen}
                onClose={() => setIsGroundingOpen(false)}
                libraryPapers={library}
                groundedPapers={chatSources}
                onTogglePaperGround={handleTogglePaperGround}
                uploadedFiles={uploadedFiles}
                onUploadFile={(file) => handleUploadFile(file)}
                onRemoveUpload={handleRemoveUpload}
                isUploading={isUploading}
            />
        </div>
    );
}
