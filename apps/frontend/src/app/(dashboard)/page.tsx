'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { injectToken } from '@/api/client';

const DashboardHome = dynamic(() => import('@/components/DashboardHome'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#2c5f9e]/30 border-t-[#2c5f9e] rounded-full animate-spin" />
        </div>
    ),
});

export default function HomePage() {
    const { getToken } = useAuth();
    const { user } = useUser();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    return <DashboardHome />;
}
