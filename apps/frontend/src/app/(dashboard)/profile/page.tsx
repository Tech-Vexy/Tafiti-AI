// @ts-nocheck
'use client';

import dynamic from 'next/dynamic';
import { useAuth, useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import { injectToken } from '@/api/client';
import { useEffect } from 'react';

const ProfileView = dynamic(() => import('@/components/ProfileView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
    ),
});

export default function ProfileViewPage() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const { userProfile } = useUserStore();
    const { handleSearch } = useResearchStore();

    useEffect(() => { injectToken(getToken); }, [getToken]);

    return (
        <ProfileView
            user={user || userProfile}
            careerField={userProfile?.career_field}
            onSearch={handleSearch}
            onProfileUpdate={() => {}}
        />
    );
}
