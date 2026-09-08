'use client';

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
            <div className="text-center space-y-6 animate-reveal">
                <div className="text-8xl font-black text-white/10">404</div>
                <h1 className="text-3xl font-black text-white">Page not found</h1>
                <p className="text-slate-500 max-w-md mx-auto">
                    The page you are looking for does not exist or has been moved.
                </p>
                <Link href="/" className="inline-block btn-primary px-8 py-3 text-sm font-bold">
                    Go Home
                </Link>
            </div>
        </div>
    );
}
