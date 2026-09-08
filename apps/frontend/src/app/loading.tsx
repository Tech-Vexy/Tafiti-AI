export default function GlobalLoading() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none animate-breathe" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/8 blur-[140px] rounded-full pointer-events-none animate-breathe" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
          <div className="absolute inset-2 border-2 border-emerald-500/20 border-b-emerald-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.2s' }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-white">Tafiti AI</h2>
          <p className="text-sm text-slate-500 font-medium">Loading experience…</p>
        </div>
      </div>
    </div>
  );
}
