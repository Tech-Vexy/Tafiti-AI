// @ts-nocheck
'use client';

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';

const ProfileView = dynamic(() => import('@/components/ProfileView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 dark:border-[#383B43] border-slate-300 dark:border-t-[#FDFBFA] border-t-[#3A3D45] rounded-full animate-spin" />
        </div>
    ),
});

export default function ProfilePanel() {
    const { user: clerkUser } = useUser();
    const { userProfile, setUserProfile, fetchUserProfile, getMergedUser } = useUserStore();

    const mergedUser = getMergedUser ? getMergedUser() : { ...userProfile, ...clerkUser };

    return (
        <ProfileView
            user={mergedUser}
            careerField={mergedUser?.career_field || userProfile?.career_field || ''}
            onProfileUpdate={(updated) => {
                if (setUserProfile) setUserProfile(prev => ({ ...prev, ...updated }));
                if (fetchUserProfile) fetchUserProfile();
            }}
        />
    );
}
