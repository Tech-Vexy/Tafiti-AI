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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user: clerkUser, isLoaded, isSignedIn } = useUser();
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

    const mergedUser = getMergedUser();

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.replace('/auth/sign-in');
        }
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        setClerkUser(clerkUser);
        if (clerkUser) {
            fetchUserProfile();
            fetchHistory();
        }
    }, [clerkUser]);

    useEffect(() => { syncTabFromPath(pathname); }, [pathname, syncTabFromPath]);

    useKeyboardShortcuts({
        onFocusSearch: () => setShowCommandPalette(prev => !prev),
        onEscape: () => { if (showCommandPalette) setShowCommandPalette(false); },
        onSynthesize: () => {
            if (selectedPapers.length > 0 && !isSynthesizing) handleSynthesize(isCollaborative);
        },
        onShowShortcuts: () => setShowShortcuts(true),
    });

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-glass)] border-t-sky-500 animate-spin" />
            </div>
        );
    }

    if (!isSignedIn) {
        return null;
    }

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
