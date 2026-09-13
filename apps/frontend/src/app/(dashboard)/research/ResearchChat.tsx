'use client';

import dynamic from 'next/dynamic';

const ResearchChatbotView = dynamic(
    () => import('@/components/ResearchChatbot/ResearchChatbotView'),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center py-32">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-700/50 border-t-sky-500 rounded-full animate-spin" />
                    <span className="text-sm">Loading research interface...</span>
                </div>
            </div>
        ),
    }
);

export default function ResearchChat() {
    return <ResearchChatbotView />;
}
