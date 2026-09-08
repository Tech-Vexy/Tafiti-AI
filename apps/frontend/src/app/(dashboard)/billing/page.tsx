// @ts-nocheck
'use client';

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';

const BillingView = dynamic(() => import('@/components/BillingView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function BillingViewPage() {
    const { user } = useUser();
    const { userProfile } = useUserStore();
    return <BillingView user={user || userProfile} />;
}
