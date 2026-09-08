'use client';

import React, { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import Breadcrumbs from '@/components/Breadcrumbs';
import CommandPalette from '@/components/CommandPalette';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import OnboardingTour from '@/components/OnboardingTour';
import { useToast } from '@/hooks/useToast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { injectToken } from '@/api/client';
import useUIStore from '@/store/useUIStore';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';
import {
    MessageSquare, Sparkles, Rocket, ArrowRight, Bookmark, FileText,
    History, Compass, CreditCard, Settings, HelpCircle,
    FlaskConical, Brain, PenLine, Lightbulb
} from 'lucide-react';
import {
    Box,
    Typography,
    Button,
    CircularProgress,
    Stack,
    Avatar,
} from '@mui/material';

const TrialBanner = ({ onStart, isStarting }) => (
    <Box
        sx={{
            mb: 4,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #eef2ff 0%, #e6f4f1 50%, #fff1e0 100%)',
            border: '1px solid rgba(44, 95, 158, 0.15)',
            p: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
        }}
    >
        <Stack direction="row" spacing={3} alignItems="center">
            <Avatar
                sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 4,
                    bgcolor: '#e6f4f1',
                    color: '#0f766e',
                }}
            >
                <Rocket style={{ width: 24, height: 24 }} />
            </Avatar>
            <Box>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 900,
                        color: '#0f172a',
                        fontSize: '1.125rem',
                        letterSpacing: '-0.02em',
                    }}
                >
                    Welcome to Tafiti AI!
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: '#475569',
                        fontWeight: 500,
                        mt: 0.5,
                    }}
                >
                    Start your free 7-day trial to unlock AI synthesis, gap analysis, and more.
                </Typography>
            </Box>
        </Stack>
        <Button
            variant="contained"
            onClick={onStart}
            disabled={isStarting}
            startIcon={isStarting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <Sparkles style={{ width: 16, height: 16 }} />}
            sx={{
                flexShrink: 0,
                px: 4,
                py: 1.5,
                fontWeight: 900,
                fontSize: '0.8125rem',
                borderRadius: 4,
                bgcolor: '#2c5f9e',
                '&:hover': { bgcolor: '#234e82' },
                '&.Mui-disabled': { opacity: 0.6 },
                textTransform: 'none',
            }}
        >
            {isStarting ? 'Starting...' : 'Start Free Trial'}
        </Button>
    </Box>
);

const ExpiredBanner = ({ onUpgrade }) => (
    <Box
        sx={{
            mb: 4,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #fff1e0 0%, #fff7ed 50%, #fef2f2 100%)',
            border: '1px solid rgba(251, 146, 60, 0.2)',
            p: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
        }}
    >
        <Stack direction="row" spacing={3} alignItems="center">
            <Avatar
                sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 4,
                    bgcolor: '#fff1e0',
                    color: '#c2410c',
                }}
            >
                <CreditCard style={{ width: 24, height: 24 }} />
            </Avatar>
            <Box>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 900,
                        color: '#0f172a',
                        fontSize: '1.125rem',
                        letterSpacing: '-0.02em',
                    }}
                >
                    Your trial has ended
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: '#475569',
                        fontWeight: 500,
                        mt: 0.5,
                    }}
                >
                    Subscribe for 200 KES/month to continue using synthesis &amp; gap analysis.
                </Typography>
            </Box>
        </Stack>
        <Button
            onClick={onUpgrade}
            startIcon={<ArrowRight style={{ width: 16, height: 16 }} />}
            sx={{
                flexShrink: 0,
                px: 4,
                py: 1.5,
                fontWeight: 900,
                fontSize: '0.8125rem',
                borderRadius: 4,
                bgcolor: '#c2410c',
                color: '#ffffff',
                '&:hover': { bgcolor: '#9a3412' },
                textTransform: 'none',
            }}
        >
            Upgrade Now
        </Button>
    </Box>
);

export default function DashboardLayout({ children }) {
    const { getToken } = useAuth();
    const { user: clerkUser } = useUser();
    const toast: any = useToast();
    const pathname = usePathname();
    const router = useRouter();

    const [showCommandPalette, setShowCommandPalette] = React.useState(false);
    const [showShortcuts, setShowShortcuts] = React.useState(false);
    const { activeTab, setActiveTab, graphPaper, setGraphPaper, setShowFeedbackModal, syncTabFromPath } = useUIStore();
    const {
        setClerkUser, getMergedUser, getTrialState,
        fetchUserProfile, fetchNotifications, markNotificationRead,
        notifications, unreadCount, isStartingTrial, handleStartTrial,
    } = useUserStore();
    const {
        papers, selectedPapers, isSynthesizing, isCollaborative,
        handleSearch, handleSynthesize,
        fetchDiscoverPapers,
    } = useResearchStore();
    const {
        fetchLibrary, fetchHistory,
    } = useLibraryStore();

    const mergedUser = getMergedUser();
    const { trialNotStarted, isTrialExpired } = getTrialState();

    const navigateToTab = (tab: string) => {
        setActiveTab(tab);
        const routes = {
            feed: '/', chat: '/chat', discover: '/discover', library: '/library',
            'gap-analysis': '/gap-analysis', notes: '/notes', history: '/history',
            billing: '/billing', profile: '/profile', support: '/support',
            thesis: '/thesis', 'research-review': '/research-review',
        };
        router.push(routes[tab] || '/');
    };

    useEffect(() => { injectToken(getToken); }, [getToken]);

    useEffect(() => {
        setClerkUser(clerkUser);
        if (clerkUser) {
            fetchUserProfile(); fetchLibrary(); fetchHistory();
            fetchNotifications(); fetchDiscoverPapers();
        }
    }, [clerkUser]);

    useEffect(() => { syncTabFromPath(pathname); }, [pathname, syncTabFromPath]);

    useEffect(() => {
        if (isTrialExpired && !mergedUser?.has_given_feedback && !mergedUser?.is_superuser) {
            setShowFeedbackModal(true);
        }
    }, [isTrialExpired, mergedUser?.has_given_feedback, mergedUser?.is_superuser]);

    useKeyboardShortcuts({
        onFocusSearch: () => setShowCommandPalette(prev => !prev),
        onEscape: () => { if (graphPaper) setGraphPaper(null); else if (showCommandPalette) setShowCommandPalette(false); },
        onSynthesize: () => {
            if (selectedPapers.length > 0 && !isSynthesizing) handleSynthesize(getToken, isCollaborative);
            else if (selectedPapers.length === 0) toast.warn('Select at least one paper before synthesizing.');
        },
        onShowShortcuts: () => setShowShortcuts(true),
    });

    const onStartTrial = async () => {
        const ok = await handleStartTrial();
        if (ok) toast.success('Your 7-day free trial has started!');
        else toast.error('Failed to start trial.');
    };

    const navItems = [
        { icon: Rocket, label: 'Home', id: 'feed', group: 'Research' },
        { icon: MessageSquare, label: 'Research Chat', id: 'chat', group: 'Research', tourTarget: 'nav-chat' },
        { icon: Compass, label: 'Discover', id: 'discover', group: 'Research' },
        { icon: Bookmark, label: 'My Library', id: 'library', group: 'Research', tourTarget: 'nav-library' },
        { icon: FlaskConical, label: 'Gap Analysis', id: 'gap-analysis', group: 'Research' },
        { icon: Brain, label: 'Workspace', id: 'workspace', group: 'Research' },
        { icon: PenLine, label: 'Thesis', id: 'thesis', group: 'Research', tourTarget: 'nav-thesis' },
        { icon: Lightbulb, label: 'Research Review', id: 'research-review', group: 'Research' },
        { icon: FileText, label: 'Notes', id: 'notes', group: 'Research' },
        { icon: History, label: 'History', id: 'history', group: 'Research' },
        { icon: CreditCard, label: 'Billing & Plans', id: 'billing', group: 'Account' },
    ].map(item => ({ ...item, active: activeTab === item.id, onClick: navigateToTab }));

    const secondaryNav = [
        { icon: Settings, label: 'Settings', id: 'profile', active: activeTab === 'profile', onClick: navigateToTab },
        { icon: HelpCircle, label: 'Support', id: 'support', active: activeTab === 'support', onClick: navigateToTab },
    ];

    return (
        <Layout
            user={mergedUser}
            unreadNotifications={unreadCount}
            notifications={notifications}
            onMarkRead={markNotificationRead}
            navItems={navItems}
            secondaryNav={secondaryNav}
        >
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onNavigate={navigateToTab}
                papers={papers}
                onSearch={handleSearch}
            />
            <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
            <OnboardingTour />
            <Box
                sx={{
                    maxWidth: '7xl',
                    mx: 'auto',
                    pt: { xs: 2.5, sm: 4 },
                    pb: { xs: 12, sm: 20 },
                    px: { xs: 2, sm: 4 },
                }}
            >
                {trialNotStarted && !mergedUser?.is_superuser && (
                    <TrialBanner onStart={onStartTrial} isStarting={isStartingTrial} />
                )}
                {isTrialExpired && !mergedUser?.is_superuser && (
                    <ExpiredBanner onUpgrade={() => navigateToTab('billing')} />
                )}
                <Box sx={{ '& > * + *': { mt: 8 } }}>
                    <Breadcrumbs />
                    {children}
                </Box>
            </Box>
        </Layout>
    );
}
