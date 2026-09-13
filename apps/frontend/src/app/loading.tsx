export default function GlobalLoading() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-sky-600/10 blur-[140px] rounded-full pointer-events-none animate-breathe" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/8 blur-[140px] rounded-full pointer-events-none animate-breathe" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-slate-700/50 border-t-sky-500 rounded-full animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-slate-200">Tafiti AI</h2>
          <p className="text-sm text-slate-500">Loading your research workspace...</p>
        </div>
      </div>
    </div>
  );
}
