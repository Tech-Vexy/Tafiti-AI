import React from 'react';
import {
    Home,
    Search,
    BookOpen,
    History,
    Settings,
    HelpCircle,
    Menu,
    X,
    CreditCard,
    ArrowUpRight,
    FileText,
    User,
    Bell,
    CheckCheck,
    ExternalLink
} from 'lucide-react';
import { Logo, LogoWithText } from './Logo';

const Layout = ({ children, user, navItems: propNavItems, secondaryNav: propSecondaryNav, unreadNotifications = 0, notifications = [], onMarkRead }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isNotifOpen, setIsNotifOpen] = React.useState(false);

    // Auto Theme Detection
    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            if (e.matches) {
                document.documentElement.classList.remove('light');
            } else {
                document.documentElement.classList.add('light');
            }
        };

        // Initial check
        handleChange(mediaQuery);

        // Listen for changes
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const isTrial = user?.subscription_status === 'trialing';
    const isActive = user?.subscription_status === 'active';
    const isExpired = user?.subscription_status === 'expired';

    const getTrialStats = () => {
        if (!user?.created_at || !user?.trial_ends_at) return { daysLeft: 0, progress: 0 };
        const start = new Date(user.created_at);
        const end = new Date(user.trial_ends_at);
        const now = new Date();

        const days = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        const total = end - start;
        const elapsed = now - start;
        const progress = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

        return { daysLeft: days, progress };
    };

    const { daysLeft, progress } = getTrialStats();

    const defaultNavItems = [
        { icon: Home, label: 'Dashboard', id: 'dashboard' },
        { icon: Search, label: 'Research', id: 'feed' },
        { icon: BookOpen, label: 'Library', id: 'library' },
        { icon: FileText, label: 'Notes', id: 'notes' },
        { icon: History, label: 'History', id: 'history' },
    ];

    const navItems = propNavItems || defaultNavItems;

    const secondaryNav = propSecondaryNav || [
        { icon: Settings, label: 'Settings', onClick: () => { } },
        { icon: HelpCircle, label: 'Support', onClick: () => { } },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex overflow-hidden selection:bg-indigo-500/30">
            {/* Mesh Gradient Background */}
            <div className="mesh-gradient opacity-60 pointer-events-none" />

            {/* Sidebar Backdrop for Mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[var(--bg-sidebar)]/80 backdrop-blur-3xl border-r border-white/5 transition-all duration-700 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-full flex flex-col p-8">
                    <div className="flex items-center justify-between mb-12">
                        <LogoWithText />
                        <button className="lg:hidden text-[var(--text-muted)] hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                        <div className="px-4 mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Workspace</span>
                        </div>
                        {navItems.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => item.onClick && item.onClick(item.id)}
                                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-500 group ${item.active ? 'bg-indigo-500/10 text-white border border-indigo-500/20 shadow-lg shadow-indigo-500/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <item.icon className={`w-5 h-5 ${item.active ? 'text-indigo-400' : 'group-hover:scale-110 group-hover:text-indigo-300 transition-all'}`} />
                                    <span className="font-bold tracking-tight">{item.label}</span>
                                </div>
                                {item.active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />}
                            </button>
                        ))}

                        <div className="px-4 mt-12 mb-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">System</span>
                        </div>
                        {secondaryNav.map((item) => (
                            <button
                                key={item.label}
                                onClick={() => item.onClick && item.onClick(item.id)}
                                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-500 group ${item.active ? 'bg-indigo-500/10 text-white border border-indigo-500/20 shadow-lg shadow-indigo-500/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <item.icon className={`w-5 h-5 ${item.active ? 'text-indigo-400' : 'group-hover:scale-110 group-hover:text-emerald-400 transition-all'}`} />
                                    <span className="font-bold tracking-tight">{item.label}</span>
                                </div>
                                {item.active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />}
                            </button>
                        ))}
                    </nav>

                    {/* User Section */}
                    <div className="pt-8 border-t border-white/5">
                        <div
                            className="flex items-center justify-between px-2 cursor-pointer group/user hover:bg-white/[0.03] p-2 rounded-2xl transition-all duration-300"
                            onClick={() => secondaryNav.find(n => n.label === 'Settings')?.onClick?.('profile')}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-emerald-400/20 rounded-2xl flex items-center justify-center text-sm font-black shadow-xl overflow-hidden group-hover/user:scale-105 transition-transform border border-white/10">
                                    {user?.imageUrl ? (
                                        <img src={user.imageUrl} alt={user.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white">
                                            {user?.username?.charAt(0).toUpperCase() || <User className="w-6 h-6" />}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white uppercase tracking-tight group-hover/user:text-indigo-300 transition-colors line-clamp-1">{user?.username || 'Researcher'}</span>
                                    <div className="flex items-center gap-2">
                                        {isActive ? (
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-1.5 py-0.5 rounded">Pro Scholar</span>
                                        ) : isTrial ? (
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-1.5 py-0.5 rounded">
                                                Trial: {daysLeft}d
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest bg-red-400/10 px-1.5 py-0.5 rounded">Expired</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover/user:text-indigo-400 transition-all opacity-0 group-hover/user:opacity-100" />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-h-screen relative overflow-y-auto custom-scrollbar">
                {/* Mobile Header */}
                <header className="sticky top-0 z-40 bg-[var(--bg-main)]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 sm:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2 glass-card rounded-xl" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="text-white w-6 h-6" />
                        </button>
                        <div className="hidden lg:block">
                            <h1 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Scholar Workspace</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className={`p-3 rounded-2xl transition-all duration-300 border ${isNotifOpen ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
                            >
                                <Bell className="w-5 h-5" />
                                {unreadNotifications > 0 && (
                                    <span className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 border-2 border-[var(--bg-main)] rounded-full text-[8px] font-black flex items-center justify-center text-white">
                                        {unreadNotifications}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 mt-4 w-[calc(100vw-2rem)] sm:w-80 max-w-sm glass-card-heavy border-white/10 shadow-2xl z-50 p-2 overflow-hidden animate-slide-up">
                                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-white">Scholar Alerts</h3>
                                        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">{unreadNotifications} New</span>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                        {notifications.length > 0 ? (
                                            notifications.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    className={`p-4 hover:bg-white/5 transition-colors cursor-pointer group border-b border-white/5 last:border-0 ${notif.is_read ? 'opacity-60' : ''}`}
                                                    onClick={() => {
                                                        if (!notif.is_read) onMarkRead(notif.id);
                                                        if (notif.link) window.location.href = notif.link;
                                                    }}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                            <Bell className="w-4 h-4 text-indigo-400" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">
                                                                {notif.content}
                                                            </p>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] text-slate-500">{new Date(notif.created_at).toLocaleDateString()}</span>
                                                                {!notif.is_read && <CheckCheck className="w-3 h-3 text-indigo-500" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <p className="text-xs text-slate-500 font-medium">All quiet in the lab.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:hidden flex items-center gap-3">
                            <Logo size="sm" />
                            <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Tafiti</span>
                        </div>
                    </div>
                </header>

                <div className="relative z-10 h-full pb-20 lg:pb-0">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[var(--bg-sidebar)]/90 backdrop-blur-xl border-t border-white/5">
                <div className="flex items-center justify-around px-2 py-2">
                    {navItems.slice(0, 5).map((item) => (
                        <button
                            key={item.label}
                            onClick={() => item.onClick && item.onClick(item.id)}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${item.active ? 'text-indigo-400' : 'text-slate-500'}`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-slate-500"
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[10px] font-bold tracking-tight">More</span>
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default Layout;
