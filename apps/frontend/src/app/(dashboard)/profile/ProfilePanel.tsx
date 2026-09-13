// @ts-nocheck
'use client';

import { useUser } from '@clerk/nextjs';
import useUserStore from '@/store/useUserStore';
import { ProfileView } from '@/components/ProfileView';

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
