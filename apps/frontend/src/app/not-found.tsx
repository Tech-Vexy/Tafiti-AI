import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-24 sm:py-32 flex flex-col items-center text-center space-y-8">
      <div className="w-24 h-24 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
        <span className="text-5xl font-bold text-sky-400/80">404</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
        Page not found
      </h1>
      <p className="text-slate-400 max-w-md mx-auto">
        We couldn&apos;t find the page you&apos;re looking for. It may have been moved, deleted, or never existed.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/research"
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md shadow-sky-500/20"
        >
          Back to Research
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800/80 text-sm font-semibold text-slate-200"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
