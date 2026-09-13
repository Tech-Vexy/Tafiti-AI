'use client';

import ResearchChatbotView from '@/components/ResearchChatbot/ResearchChatbotView';

interface ResearchChatProps {
    initialQuery?: string;
}

export default function ResearchChat({ initialQuery }: ResearchChatProps) {
    return <ResearchChatbotView initialQuery={initialQuery} />;
}
