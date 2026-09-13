'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { tabFromPathname } from '@/store/useUIStore';

const LABELS: Record<string, string> = {
    feed: 'Home',
    chat: 'Research Chat',
    history: 'History',
    billing: 'Billing',
    profile: 'Profile',
};

const Breadcrumbs = () => {
    const pathname = usePathname();
    const tab = tabFromPathname(pathname);

    if (tab === 'feed') return null;

    return (
        <nav aria-label="Breadcrumb" className="mb-6 animate-fade-in">
            <ol className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <li>
                    <Link href="/" className="flex items-center gap-1.5 hover:text-sky-400 transition-colors">
                        <Home className="w-3 h-3" /> Home
                    </Link>
                </li>
                <li aria-hidden="true"><ChevronRight className="w-3 h-3 text-slate-600" /></li>
                <li className="text-[var(--text-main)] font-bold" aria-current="page">{LABELS[tab] || tab}</li>
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
