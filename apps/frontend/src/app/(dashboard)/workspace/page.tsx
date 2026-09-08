// @ts-nocheck
'use client';

import dynamic from 'next/dynamic';

const WorkspaceView = dynamic(() => import('@/components/WorkspaceView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function WorkspaceViewPage() {
    return <WorkspaceView />;
}
