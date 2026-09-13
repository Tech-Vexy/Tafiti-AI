'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import {
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Trash2,
    Settings,
    MessageSquare,
    Sun,
    Moon,
    Monitor,
    ArrowUpRight,
    CreditCard,
} from 'lucide-react';
import useResearchStore from '@/store/useResearchStore';
import useLibraryStore from '@/store/useLibraryStore';

type LayoutProps = {
    children: React.ReactNode;
    user?: any;
};

type ThemeMode = 'system' | 'light' | 'dark';

/* ── Helpers ─────────────────────────────────────────────── */

function groupHistoryByTime(history: any[]) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 7);

    const groups: { label: string; items: any[] }[] = [
        { label: 'Today', items: [] },
        { label: 'Yesterday', items: [] },
        { label: 'Previous 7 Days', items: [] },
        { label: 'Older', items: [] },
    ];

    // Realtime sorting: ensure newest/live investigations are prioritized first
    const sorted = [...history].sort((a, b) => {
        const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
        const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
        return timeB - timeA;
    });

    sorted.forEach((item) => {
        const d = new Date(item.created_at || item.timestamp || 0);
        if (d >= todayStart) groups[0].items.push(item);
        else if (d >= yesterdayStart) groups[1].items.push(item);
        else if (d >= weekAgoStart) groups[2].items.push(item);
        else groups[3].items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
}

/* ── Theme Hook ──────────────────────────────────────────── */

function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
    const [mode, setMode] = useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return 'system';
        const saved = localStorage.getItem('tafiti-theme');
        return saved === 'light' || saved === 'dark' || saved === 'system'
            ? saved
            : 'system';
    });

    useEffect(() => {
        localStorage.setItem('tafiti-theme', mode);
        // Dispatch storage event so ThemeModeProvider in Providers.tsx picks it up
        window.dispatchEvent(new StorageEvent('storage', { key: 'tafiti-theme', newValue: mode }));

        // Also directly apply the class (in case the provider doesn't catch the event immediately)
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const isDark = mode === 'dark' || (mode === 'system' && mq.matches);
        document.documentElement.classList.toggle('light', !isDark);
        document.documentElement.classList.toggle('dark', isDark);
    }, [mode]);

    return [mode, setMode];
}

/* ── Logo ────────────────────────────────────────────────── */

const TafitiLogo = ({ collapsed }: { collapsed: boolean }) => {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push('/')}
            aria-label="Tafiti AI Home"
            title="Tafiti AI Home"
            className={`flex items-center ${collapsed ? 'justify-center mx-auto' : 'gap-2.5'} group`}
        >
            <div
                className="w-9 h-9 rounded-xl bg-[var(--btn-surface)] border border-[var(--btn-border)] flex items-center justify-center shrink-0 group-hover:scale-105 group-active:scale-95 transition-transform overflow-hidden shadow-sm"
                style={{ boxShadow: 'var(--logo-shadow)' }}
            >
                <img
                    src="/android-chrome-192x192.png"
                    alt="Tafiti AI"
                    className="w-6 h-6 object-contain rounded-lg"
                />
            </div>
        {!collapsed && (
            <span className="font-bold text-[15px] text-[var(--text-main)] tracking-tight select-none">
                Tafiti AI
            </span>
        )}
    </button>
    );
};

/* ── Theme Toggle ────────────────────────────────────────── */

const ThemeToggle = ({
    mode,
    setMode,
    collapsed,
}: {
    mode: ThemeMode;
    setMode: (m: ThemeMode) => void;
    collapsed: boolean;
}) => {
    const cycle = () => {
        const order: ThemeMode[] = ['system', 'light', 'dark'];
        const next = order[(order.indexOf(mode) + 1) % order.length];
        setMode(next);
    };

    const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
    const label = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';

    return (
        <button
            onClick={cycle}
            title={`Theme: ${label}`}
            aria-label={`Cycle theme mode. Current: ${label}`}
            className={`flex items-center ${
                collapsed ? 'w-10 h-10 mx-auto justify-center' : 'w-full gap-2.5 px-3 py-2'
            } rounded-xl text-[13px] font-medium transition-all hover:bg-[var(--sidebar-hover)]`}
            style={{ color: 'var(--text-dim)' }}
        >
            <Icon className="w-4 h-4" style={{ color: 'var(--icon-dim)' }} />
            {!collapsed && <span>{label}</span>}
        </button>
    );
};

/* ── History Item ────────────────────────────────────────── */

const HistoryItem = ({
    item,
    isActive,
    onLoad,
    onDelete,
}: {
    item: any;
    isActive: boolean;
    onLoad: () => void;
    onDelete: (e: React.MouseEvent) => void;
}) => (
    <div
        onClick={onLoad}
        className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
            isActive
                ? 'bg-[var(--sidebar-active)] text-[var(--text-main)] shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'
        }`}
    >
        {item.isLive ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
        ) : (
            <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
        )}
        <span className="truncate flex-1">{item.title || item.query}</span>
        {item.isLive && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 animate-pulse">
                Live
            </span>
        )}
        <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:bg-[var(--sidebar-hover)]"
            title="Delete research session"
            aria-label={`Delete history item: ${item.title || item.query || 'research session'}`}
            style={{ color: 'var(--danger-text)' }}
        >
            <Trash2 className="w-3 h-3" />
        </button>
    </div>
);

/* ── Main Layout ─────────────────────────────────────────── */

export default function Layout({ children, user }: LayoutProps) {
    const router = useRouter();
    const { signOut, openUserProfile } = useClerk();
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [themeMode, setThemeMode] = useThemeMode();

    const history = useLibraryStore((s) => s.history);
    const fetchHistory = useLibraryStore((s) => s.fetchHistory);
    const activeChatId = useResearchStore((s) => s.activeChatId);
    const startNewChat = useResearchStore((s) => s.startNewChat);
    const loadChatSession = useResearchStore((s) => s.loadChatSession);
    const deleteChatSession = useResearchStore((s) => s.deleteChatSession);

    useEffect(() => {
        fetchHistory();

        // Real-time synchronization when tab gets focus or becomes visible
        const handleFocus = () => {
            fetchHistory(true);
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchHistory(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Background sync every 30 seconds while window is open and visible
        const syncInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchHistory();
            }
        }, 30000);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(syncInterval);
        };
    }, [fetchHistory]);

    const handleNewChat = () => {
        startNewChat();
        router.push('/research');
    };

    const handleLoadSession = (item: any) => {
        loadChatSession(item);
        router.push('/research');
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: any) => {
        e.stopPropagation();
        await deleteChatSession(id);
    };

    const displayName = user?.fullName || user?.username || 'Researcher';
    const userInitials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const groupedHistory = useMemo(() => groupHistoryByTime(history), [history]);

    return (
        <div className="min-h-screen flex bg-[var(--bg-main)] text-[var(--text-main)]">
            {/* ── Sidebar ─────────────────────────────────────── */}
            <aside
                aria-label="Primary navigation sidebar"
                className={`fixed inset-y-0 left-0 z-40 ${
                    collapsed ? 'w-[4.25rem]' : 'w-[260px]'
                } flex flex-col bg-[var(--bg-sidebar)] transition-all duration-300`}
                style={{ borderRight: '1px solid var(--sidebar-border)' }}
            >
                {/* Top: Logo + Collapse */}
                {collapsed ? (
                    <div className="flex flex-col items-center gap-1.5 pt-3.5 pb-1 px-2">
                        <TafitiLogo collapsed={true} />
                        <button
                            onClick={() => setCollapsed(false)}
                            aria-label="Expand sidebar"
                            title="Expand sidebar"
                            className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <TafitiLogo collapsed={false} />
                        <button
                            onClick={() => setCollapsed(true)}
                            aria-label="Collapse sidebar"
                            title="Collapse sidebar"
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--sidebar-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                        >
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* New Research Button */}
                <div className="px-3 pt-1 pb-1.5">
                    {collapsed ? (
                        <button
                            onClick={handleNewChat}
                            title="New Research"
                            aria-label="Start new research investigation"
                            className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all group bg-[var(--btn-surface)] hover:bg-[var(--btn-surface-hover)] text-[var(--text-main)]"
                            style={{ border: '1px solid var(--btn-border)' }}
                        >
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                    ) : (
                        <button
                            onClick={handleNewChat}
                            aria-label="Start new research investigation"
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all group bg-[var(--btn-surface)] hover:bg-[var(--btn-surface-hover)] text-[var(--text-main)]"
                            style={{ border: '1px solid var(--btn-border)' }}
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" style={{ color: 'var(--icon-dim)' }} />
                            <span>New Research</span>
                        </button>
                    )}
                </div>

                {/* Research History / Active Investigations */}
                {!collapsed ? (
                    <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 custom-scrollbar">
                        {groupedHistory.length > 0 ? (
                            groupedHistory.map((group) => (
                                <div key={group.label} className="mb-3">
                                    <div
                                        className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        {group.label}
                                    </div>
                                    <div className="space-y-0.5">
                                        {group.items.map((item: any) => (
                                             <HistoryItem
                                                key={item.id}
                                                item={item}
                                                isActive={activeChatId === item.id}
                                                onLoad={() => handleLoadSession(item)}
                                                onDelete={(e) => handleDeleteSession(e, item.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : null}
                    </div>
                ) : (
                    <div className="flex-1" />
                )}

                {/* Bottom: Subscription + Theme toggle + User Profile */}
                <div className="px-3 py-2 space-y-1.5" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
                    {/* Upgrade Button near user controls */}
                    <div>
                        {collapsed ? (
                            <button
                                onClick={() => router.push('/billing')}
                                title="Upgrade"
                                aria-label="Upgrade"
                                className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all border dark:border-[#383B43] border-[#8A8884]/30 dark:bg-[#1E1D1C] bg-[#FDFAF9] dark:text-[#FDFBFA] text-[#3A3D45] hover:border-[#383B43] dark:hover:bg-[#383B43]/50 hover:bg-slate-100"
                            >
                                <ArrowUpRight className="w-4 h-4 text-[var(--text-dim)]" />
                            </button>
                        ) : (
                            <button
                                onClick={() => router.push('/billing')}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all border dark:border-[#383B43] border-[#8A8884]/30 dark:bg-[#1E1D1C] bg-[#FDFAF9] dark:text-[#FDFBFA] text-[#3A3D45] hover:border-[#383B43] dark:hover:bg-[#383B43]/50 hover:bg-slate-100"
                            >
                                <span>Upgrade</span>
                                <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)]" />
                            </button>
                        )}
                    </div>

                    {/* Theme Toggle */}
                    <ThemeToggle mode={themeMode} setMode={setThemeMode} collapsed={collapsed} />

                    {/* User */}
                    <div className="relative mt-1">
                        {collapsed ? (
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="w-10 h-10 mx-auto rounded-xl dark:bg-[#383B43] bg-slate-200 flex items-center justify-center text-xs font-bold dark:text-[#FDFBFA] text-[#3A3D45] overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
                                style={{
                                    border: '1px solid var(--btn-border)',
                                    ...(user?.imageUrl
                                        ? { backgroundImage: `url(${user.imageUrl})`, backgroundSize: 'cover' }
                                        : {}),
                                }}
                                aria-label={userMenuOpen ? 'Close user menu' : `Open user menu for ${displayName}`}
                            >
                                {!user?.imageUrl && userInitials}
                            </button>
                        ) : (
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--sidebar-hover)] transition-colors"
                                aria-label={userMenuOpen ? 'Close user menu' : `Open user menu for ${displayName}`}
                            >
                                <span
                                    className="w-8 h-8 rounded-lg dark:bg-[#383B43] bg-slate-200 flex items-center justify-center text-[11px] font-bold dark:text-[#FDFBFA] text-[#3A3D45] overflow-hidden shrink-0"
                                    style={
                                        user?.imageUrl
                                            ? { backgroundImage: `url(${user.imageUrl})`, backgroundSize: 'cover' }
                                            : undefined
                                    }
                                >
                                    {!user?.imageUrl && userInitials}
                                </span>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="text-[13px] font-semibold text-[var(--text-main)] truncate">
                                        {displayName}
                                    </div>
                                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                        {user?.email || 'researcher'}
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* User Menu Popover */}
                        {userMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                <div
                                    className={`absolute z-50 ${
                                        collapsed ? 'left-full ml-2' : 'left-3 right-3'
                                    } bottom-full mb-2 rounded-xl overflow-hidden backdrop-blur-2xl`}
                                    style={{
                                        backgroundColor: 'var(--menu-bg)',
                                        border: '1px solid var(--menu-border)',
                                        boxShadow: 'var(--menu-shadow)',
                                    }}
                                >
                                    <div className="p-1.5 space-y-0.5">
                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                router.push('/billing');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--menu-item-hover)]"
                                            style={{ color: 'var(--text-dim)' }}
                                        >
                                            <CreditCard className="w-4 h-4" style={{ color: 'var(--icon-dim)' }} />
                                            Subscription & Billing
                                        </button>
                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                openUserProfile?.();
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--menu-item-hover)]"
                                            style={{ color: 'var(--text-dim)' }}
                                        >
                                            <Settings className="w-4 h-4" style={{ color: 'var(--icon-dim)' }} />
                                            Account
                                        </button>
                                        <button
                                            onClick={() => signOut({ redirectUrl: '/' })}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--danger-hover)]"
                                            style={{ color: 'var(--danger-text)' }}
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────── */}
            <main
                id="main-content"
                className={`min-w-0 flex-1 ${
                    collapsed ? 'pl-[4.25rem]' : 'pl-[260px]'
                } transition-all duration-300`}
            >
                {children}
            </main>
        </div>
    );
}