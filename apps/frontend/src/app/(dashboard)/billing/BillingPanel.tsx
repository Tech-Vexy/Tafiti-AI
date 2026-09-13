// @ts-nocheck
'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';

const BillingView = dynamic(() => import('@/components/BillingView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 dark:border-[#383B43] border-slate-300 dark:border-t-[#FDFBFA] border-t-[#3A3D45] rounded-full animate-spin" />
        </div>
    ),
});

export default function BillingPanel() {
    const { user: clerkUser } = useUser();
    const { userProfile, fetchUserProfile, getMergedUser } = useUserStore();

    useEffect(() => {
        if (clerkUser) {
            fetchUserProfile();
        }
    }, [clerkUser, fetchUserProfile]);

    const user = getMergedUser() || userProfile;

    return <BillingView user={user} />;
}
