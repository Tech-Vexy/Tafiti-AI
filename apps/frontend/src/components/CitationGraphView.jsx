/**
 * CitationGraphView — Live citation graph modal.
 * Fetches references (papers seed cites) and cited_by (papers that cite seed)
 * from /api/v1/research/papers/{id}/citation-graph, then draws a three-column
 * hub-and-spoke layout with SVG bezier-curve connections.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Loader2, AlertCircle, Network, ArrowLeft, ArrowRight,
    BookOpen, Zap, ExternalLink, Search, GitFork
} from 'lucide-react';
import api from '../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function citationColor(count = 0) {
    if (count >= 500) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5';
    if (count >= 100) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5';
    if (count >= 10)  return 'text-indigo-400 border-indigo-400/30 bg-indigo-400/5';
    return 'text-slate-400 border-slate-700 bg-white/5';
}

// ── Sub-components ────────────────────────────────────────────────────────────

const NodeCard = React.forwardRef(({ paper, role, isActive, onClick }, ref) => {
    const colorClass = citationColor(paper.citations);
    const isSeed = role === 'seed';

    return (
        <div
            ref={ref}
            onClick={() => onClick && onClick(paper)}
            className={`
                relative group cursor-pointer select-none rounded-2xl border p-4 transition-all duration-300
                ${isSeed
                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/20 scale-105 ring-2 ring-indigo-500/20'
                    : isActive
                        ? 'bg-white/10 border-indigo-400/50 shadow-md'
                        : 'bg-white/[0.03] border-white/10 hover:border-indigo-400/30 hover:bg-white/[0.06]'
                }
            `}
        >
            {isSeed && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest shadow">
                    Seed Paper
                </div>
            )}
            <p className="text-xs font-bold text-white leading-snug line-clamp-3 mb-2">
                {paper.title}
            </p>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] text-slate-500 font-medium">
                    {paper.authors?.[0] || 'Unknown'}{paper.authors?.length > 1 ? ' et al.' : ''} · {paper.year || 'n.d.'}
                </span>
                {paper.citations > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${colorClass}`}>
                        {paper.citations.toLocaleString()} cites
                    </span>
                )}
            </div>
        </div>
    );
});
NodeCard.displayName = 'NodeCard';

// ── Main Component ────────────────────────────────────────────────────────────

const CitationGraphView = ({ paperId, paperTitle, onClose, onSearch }) => {
    const [graphData, setGraphData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeNode, setActiveNode] = useState(null);
    const [lines, setLines] = useState([]);

    // Refs for SVG line positioning
    const containerRef = useRef(null);
    const seedRef = useRef(null);
    const refNodeRefs = useRef([]);
    const citeNodeRefs = useRef([]);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        setIsLoading(true);
        setError(null);

        api.get(`/research/papers/${paperId}/citation-graph`)
            .then(res => { if (mounted) setGraphData(res.data); })
            .catch(e => { if (mounted) setError(e?.response?.data?.detail || e.message || 'Failed to load graph'); })
            .finally(() => { if (mounted) setIsLoading(false); });

        return () => { mounted = false; };
    }, [paperId]);

    // ── Draw SVG lines after data + DOM are ready ──────────────────────────────
    const recalcLines = useCallback(() => {
        if (!containerRef.current || !seedRef.current) return;

        const container = containerRef.current.getBoundingClientRect();
        const seed = seedRef.current.getBoundingClientRect();

        const seedCx = seed.left + seed.width / 2 - container.left;
        const seedCy = seed.top + seed.height / 2 - container.top;
        const seedLeft = seed.left - container.left;
        const seedRight = seed.right - container.left;

        const newLines = [];

        // Lines from reference nodes → left side of seed
        refNodeRefs.current.forEach(el => {
            if (!el) return;
            const r = el.getBoundingClientRect();
            const x1 = r.right - container.left;
            const y1 = r.top + r.height / 2 - container.top;
            const x2 = seedLeft;
            const y2 = seedCy;
            const mx = (x1 + x2) / 2;
            newLines.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, type: 'ref' });
        });

        // Lines from right side of seed → citing nodes
        citeNodeRefs.current.forEach(el => {
            if (!el) return;
            const r = el.getBoundingClientRect();
            const x1 = seedRight;
            const y1 = seedCy;
            const x2 = r.left - container.left;
            const y2 = r.top + r.height / 2 - container.top;
            const mx = (x1 + x2) / 2;
            newLines.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, type: 'cite' });
        });

        setLines(newLines);
    }, []);

    useEffect(() => {
        if (!graphData || isLoading) return;
        // Wait one tick for DOM layout to stabilise
        const id = setTimeout(recalcLines, 80);
        return () => clearTimeout(id);
    }, [graphData, isLoading, recalcLines]);

    // Also recalc on window resize
    useEffect(() => {
        window.addEventListener('resize', recalcLines);
        return () => window.removeEventListener('resize', recalcLines);
    }, [recalcLines]);

    // ── Render states ──────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md overflow-y-auto py-8 px-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-7xl bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <GitFork className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white uppercase tracking-widest">Live Citation Graph</p>
                            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[500px]">{paperTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 min-h-[60vh]">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                            <p className="text-slate-400 text-sm font-medium animate-pulse">Fetching citation connections from OpenAlex…</p>
                        </div>
                    )}

                    {error && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                            <p className="text-red-400 font-bold">Failed to load citation graph</p>
                            <p className="text-slate-500 text-xs max-w-xs">{error}</p>
                        </div>
                    )}

                    {graphData && !isLoading && (
                        <>
                            {/* Stats bar */}
                            <div className="flex flex-wrap items-center gap-6 mb-8 pb-6 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-indigo-400">References</span>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black">
                                        {graphData.references?.length}/{graphData.total_references_count}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Network className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Total Citations</span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-black">
                                        {(graphData.total_cited_by_count || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4 text-yellow-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-yellow-400">Citing Papers Shown</span>
                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-black">
                                        {graphData.cited_by?.length}
                                    </span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-6 mb-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-8 h-0.5 bg-indigo-500/60 inline-block" />
                                    Seed cites these (past)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-8 h-0.5 bg-emerald-500/60 inline-block" />
                                    These cite seed (future)
                                </span>
                            </div>

                            {/* Graph: 3-column layout with SVG overlay */}
                            <div
                                ref={containerRef}
                                className="relative grid grid-cols-[1fr_280px_1fr] gap-6 items-center"
                            >
                                {/* SVG overlay for connection lines */}
                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    style={{ overflow: 'visible', zIndex: 0 }}
                                >
                                    {lines.map((line, i) => (
                                        <path
                                            key={i}
                                            d={line.d}
                                            fill="none"
                                            stroke={line.type === 'ref' ? 'rgba(99,102,241,0.35)' : 'rgba(52,211,153,0.35)'}
                                            strokeWidth="1.5"
                                            strokeDasharray={line.type === 'ref' ? '4 3' : '0'}
                                        />
                                    ))}
                                </svg>

                                {/* Left column: References */}
                                <div className="space-y-3 relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                                        <ArrowLeft className="w-3 h-3" /> Past · References
                                    </p>
                                    {graphData.references?.length === 0 && (
                                        <p className="text-xs text-slate-600 italic py-8 text-center border border-dashed border-white/5 rounded-2xl">
                                            No references indexed in OpenAlex
                                        </p>
                                    )}
                                    {graphData.references?.map((paper, i) => (
                                        <NodeCard
                                            key={paper.id}
                                            ref={el => refNodeRefs.current[i] = el}
                                            paper={paper}
                                            role="ref"
                                            isActive={activeNode?.id === paper.id}
                                            onClick={p => setActiveNode(prev => prev?.id === p.id ? null : p)}
                                        />
                                    ))}
                                </div>

                                {/* Center: Seed */}
                                <div className="flex flex-col items-center relative z-10">
                                    {graphData.seed && (
                                        <NodeCard
                                            ref={seedRef}
                                            paper={graphData.seed}
                                            role="seed"
                                            isActive={false}
                                            onClick={() => {}}
                                        />
                                    )}
                                </div>

                                {/* Right column: Cited By */}
                                <div className="space-y-3 relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center justify-end gap-2">
                                        Future · Citing Papers <ArrowRight className="w-3 h-3" />
                                    </p>
                                    {graphData.cited_by?.length === 0 && (
                                        <p className="text-xs text-slate-600 italic py-8 text-center border border-dashed border-white/5 rounded-2xl">
                                            No citing papers found yet
                                        </p>
                                    )}
                                    {graphData.cited_by?.map((paper, i) => (
                                        <NodeCard
                                            key={paper.id}
                                            ref={el => citeNodeRefs.current[i] = el}
                                            paper={paper}
                                            role="cite"
                                            isActive={activeNode?.id === paper.id}
                                            onClick={p => setActiveNode(prev => prev?.id === p.id ? null : p)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Active node detail panel */}
                            {activeNode && (
                                <div className="mt-8 p-6 rounded-2xl bg-white/[0.04] border border-white/10 animate-fade-in space-y-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-base font-black text-white leading-snug mb-2">{activeNode.title}</p>
                                            <p className="text-xs text-slate-400">
                                                {activeNode.authors?.join(', ')} · {activeNode.year} · {activeNode.citations?.toLocaleString()} citations
                                            </p>
                                            {activeNode.abstract && (
                                                <p className="text-xs text-slate-500 mt-3 leading-relaxed line-clamp-4">{activeNode.abstract}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0">
                                            {onSearch && (
                                                <button
                                                    onClick={() => { onSearch(activeNode.title); onClose(); }}
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-xs font-black uppercase tracking-widest transition-all"
                                                >
                                                    <Search className="w-3.5 h-3.5" />
                                                    Search This
                                                </button>
                                            )}
                                            <a
                                                href={`https://openalex.org/${activeNode.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:text-white text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                OpenAlex
                                            </a>
                                            <button
                                                onClick={() => setActiveNode(null)}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:text-white text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CitationGraphView;
