'use client';

import React from 'react';
import {
    Activity,
    Database,
    Flame,
    BookOpen,
    Code2,
    ExternalLink,
    ArrowUpRight,
    Search,
    Cpu,
    Globe2,
    CheckCircle2,
} from 'lucide-react';
import useResearchStore from '@/store/useResearchStore';

interface AcademicTerminalDashboardProps {
    onSelectQuery: (query: string) => void;
    onInsertSyntax: (syntax: string) => void;
}

const TRENDING_INVESTIGATIONS = [
    {
        title: 'Genomic Surveillance & Drug-Resistant Plasmodium falciparum in East Africa',
        category: 'Infectious Diseases',
        repository: 'AJOL / Lancet ID',
        papersCount: '14.2k papers',
        tag: 'High Priority',
        query: 'Genomic surveillance of artemisinin-resistant malaria in East Africa and therapeutic efficacy',
    },
    {
        title: 'Benchmarking LLM Performance on Low-Resource African Languages: Swahili, Yoruba & Amharic',
        category: 'Artificial Intelligence',
        repository: 'AfricArXiv / Masakhane',
        papersCount: '3.8k papers',
        tag: 'Preprint Hot',
        query: 'Empirical benchmark comparison of LLMs and machine translation on low-resource African languages',
    },
    {
        title: 'Fintech Micro-Lending, Mobile Money Adoption & MSME Liquidity Constraints',
        category: 'Economics & Development',
        repository: 'AAS Open Research / CORE',
        papersCount: '8.6k papers',
        tag: 'Policy Impact',
        query: 'Impact of mobile money overdraft and fintech micro-lending on MSME growth in Kenya and Nigeria',
    },
    {
        title: 'Decentralized Solar PV Mini-Grids & Agricultural Irrigation Resilience in the Sahel',
        category: 'Climate & Energy',
        repository: 'DOAJ / OpenAlex',
        papersCount: '6.1k papers',
        tag: 'Empirical Review',
        query: 'Techno-economic assessment of solar-powered mini-grids and irrigation resilience in the Sahel',
    },
];

const BOOLEAN_SYNTAX_OPERATORS = [
    { label: 'title:"..."', insert: 'title:"malaria" ', desc: 'Search exact title term' },
    { label: 'source:ajol', insert: 'source:ajol ', desc: 'Filter African Journals Online' },
    { label: 'source:africarxiv', insert: 'source:africarxiv ', desc: 'Filter AfricArXiv preprints' },
    { label: 'doi:10.xxxx', insert: 'doi:10. ', desc: 'Query paper DOI' },
    { label: 'year:>=2023', insert: 'year:>=2023 ', desc: 'Recent publications' },
    { label: 'AND', insert: 'AND ', desc: 'Boolean intersection' },
    { label: 'OR', insert: 'OR ', desc: 'Boolean union' },
    { label: 'open_access:true', insert: 'open_access:true ', desc: 'Open Access only' },
];

const REPOSITORY_NODES = [
    { name: 'AJOL', desc: 'African Journals Online', count: '650+ African Journals', status: 'Active', ping: '120ms' },
    { name: 'AfricArXiv', desc: 'Pan-African Preprints & Repositories', count: '50k+ Research Outputs', status: 'Active', ping: '180ms' },
    { name: 'OpenAlex', desc: 'Global Scholarly Index', count: '250M+ Works', status: 'Active', ping: '85ms' },
    { name: 'Semantic Scholar', desc: 'Allen AI Citation Graph', count: '215M+ Papers', status: 'Active', ping: '140ms' },
    { name: 'CORE UK', desc: 'Global Open Access Harvester', count: '200M+ Full Texts', status: 'Active', ping: '160ms' },
    { name: 'DOAJ', desc: 'Directory of Open Access Journals', count: '19.8k Journals', status: 'Active', ping: '210ms' },
];

export default function AcademicTerminalDashboard({
    onSelectQuery,
    onInsertSyntax,
}: AcademicTerminalDashboardProps) {
    const { selectedIndexes } = useResearchStore();

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 pt-2 pb-6 animate-reveal">
            {/* ── TOP SYSTEM STATUS RIBBON ── */}
            <div
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-xs font-mono"
                style={{
                    background: 'var(--bg-elevated, rgba(15, 23, 42, 0.8))',
                    borderColor: 'var(--border-subtle, rgba(51, 65, 85, 0.5))',
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4" />
                    <span className="font-bold text-slate-200">TAFITI ACADEMIC RESEARCH TERMINAL v2.4</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-sky-400">AGNO PARALLEL ROUTER</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-sky-400" />
                        <strong className="text-slate-200">250M+</strong> PAPERS
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Globe2 className="w-3 h-3 text-emerald-400" />
                        <strong className="text-slate-200">{selectedIndexes.length}</strong> ACTIVE NODES
                    </span>
                    <span className="hidden sm:inline-block text-slate-500 font-mono">
                        APA 7th READY
                    </span>
                </div>
            </div>

            {/* ── SECTION 1: TRENDING INVESTIGATIONS IN AFRICAN REPOSITORIES ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-slate-300">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Trending Pan-African & Global Investigations</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">1-Click Pipeline Run</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TRENDING_INVESTIGATIONS.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onSelectQuery(item.query)}
                            className="group flex flex-col justify-between text-left p-3 rounded-lg border transition-all hover:scale-[1.01] hover:border-sky-500/50 hover:bg-slate-800/60"
                            style={{
                                background: 'var(--pill-bg, rgba(15, 23, 42, 0.6))',
                                borderColor: 'var(--pill-border, rgba(51, 65, 85, 0.4))',
                            }}
                        >
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                    <span className="text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                        {item.repository}
                                    </span>
                                    <span className="text-slate-500">{item.papersCount}</span>
                                </div>
                                <h3 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-sky-300 transition-colors line-clamp-2 leading-snug">
                                    {item.title}
                                </h3>
                            </div>

                            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                                <span className="text-sky-400/80">{item.category}</span>
                                <span className="flex items-center gap-1 text-slate-400 group-hover:text-slate-200">
                                    <span>Run Pipeline</span>
                                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── SECTION 2: ADVANCED BOOLEAN & STRUCTURED SYNTAX BUILDER ── */}
            <div
                className="p-3.5 rounded-lg border space-y-2.5 font-mono"
                style={{
                    background: 'var(--bg-elevated, rgba(15, 23, 42, 0.5))',
                    borderColor: 'var(--border-subtle, rgba(51, 65, 85, 0.4))',
                }}
            >
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-300">
                        <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Advanced Boolean & Parameter Syntax</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Click to append to query prompt</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {BOOLEAN_SYNTAX_OPERATORS.map((op, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onInsertSyntax(op.insert)}
                            title={op.desc}
                            className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 text-xs transition-colors flex items-center gap-1"
                        >
                            <span>{op.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── SECTION 3: REPOSITORY TOPOLOGY & TELEMETRY STATUS ── */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-semibold uppercase tracking-wider text-slate-300">
                            Academic Pipeline Topology
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-500">Automated Hybrid Retrieval</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                    {REPOSITORY_NODES.map((node, idx) => (
                        <div
                            key={idx}
                            className="p-2.5 rounded-lg border text-left flex flex-col justify-between"
                            style={{
                                background: 'var(--pill-bg, rgba(15, 23, 42, 0.4))',
                                borderColor: 'var(--pill-border, rgba(51, 65, 85, 0.3))',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-200">{node.name}</span>
                                <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    {node.ping}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 truncate">{node.desc}</span>
                            <span className="text-[9px] text-sky-400 mt-0.5">{node.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
