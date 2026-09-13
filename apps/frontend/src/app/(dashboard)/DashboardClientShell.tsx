'use client';

import React, { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import CommandPalette from '@/components/CommandPalette';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import OnboardingPersonalizationModal from '@/components/OnboardingPersonalizationModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import useUIStore from '@/store/useUIStore';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';

interface DashboardClientShellProps {
    initialUser: any;
    children: React.ReactNode;
}

export default function DashboardClientShell({ initialUser, children }: DashboardClientShellProps) {
    const { user: clerkUser } = useUser();
    const pathname = usePathname();
    const router = useRouter();

    const [showCommandPalette, setShowCommandPalette] = React.useState(false);
    const [showShortcuts, setShowShortcuts] = React.useState(false);
    const { syncTabFromPath } = useUIStore();
    const {
        setClerkUser, getMergedUser,
        fetchUserProfile,
    } = useUserStore();
    const {
        papers, selectedPapers, isSynthesizing, isCollaborative,
        handleSearch, handleSynthesize,
    } = useResearchStore();
    const {
        fetchHistory,
    } = useLibraryStore();

    const mergedUser = getMergedUser() || initialUser;

    useEffect(() => {
        if (clerkUser) {
            setClerkUser(clerkUser);
            fetchUserProfile();
            fetchHistory();
        }
    }, [clerkUser, setClerkUser, fetchUserProfile, fetchHistory]);

    useEffect(() => {
        syncTabFromPath(pathname);
    }, [pathname, syncTabFromPath]);

    useKeyboardShortcuts({
        onFocusSearch: () => setShowCommandPalette(prev => !prev),
        onEscape: () => { if (showCommandPalette) setShowCommandPalette(false); },
        onSynthesize: () => {
            if (selectedPapers.length > 0 && !isSynthesizing) handleSynthesize(isCollaborative);
        },
        onShowShortcuts: () => setShowShortcuts(true),
    });

    return (
        <Layout user={mergedUser}>
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onNavigate={(tab: string) => router.push(tab === 'feed' || tab === 'research' ? '/research' : `/${tab}`)}
                papers={papers}
                onSearch={handleSearch}
            />
            <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
            <OnboardingPersonalizationModal />

            <div className="min-h-screen">
                {children}
            </div>
        </Layout>
    );
}
