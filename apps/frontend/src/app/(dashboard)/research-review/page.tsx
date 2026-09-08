'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { injectToken } from '@/api/client';

const ResearchReviewView = dynamic(() => import('@/components/ResearchReviewView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function ResearchReviewPage() {
    const { getToken } = useAuth();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    return <ResearchReviewView />;
}