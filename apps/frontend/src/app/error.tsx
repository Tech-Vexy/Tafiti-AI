'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-xl mx-auto px-4 py-24 sm:py-32 flex flex-col items-center text-center space-y-8">
      <div className="w-24 h-24 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
        <span className="text-5xl font-bold text-rose-400/80">!</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
        Something went wrong
      </h1>
      <p className="text-slate-400 max-w-md mx-auto">
        We hit an unexpected error while processing this page. You can try again, or return to your research.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-500/20"
        >
          Try again
        </button>
        <Link
          href="/research"
          className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800/80 text-sm font-semibold text-slate-200"
        >
          Go to Research
        </Link>
      </div>
    </main>
  );
}
