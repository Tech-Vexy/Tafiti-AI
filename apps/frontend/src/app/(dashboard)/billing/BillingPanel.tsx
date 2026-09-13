// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';
import { BillingView } from '@/components/BillingView';

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
