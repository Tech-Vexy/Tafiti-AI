'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-rose-600/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/8 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg w-full">
        <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">
          Something went wrong
        </h1>
        <p className="text-slate-400 mb-2 text-base font-medium">
          An unexpected error occurred
        </p>
        {error?.message && (
          <p className="text-xs text-slate-600 mb-10 font-mono bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-left break-words">
            {error.message}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white font-bold transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)' }}
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="px-8 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
