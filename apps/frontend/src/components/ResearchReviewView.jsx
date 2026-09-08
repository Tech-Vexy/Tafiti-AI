import React, { useState } from 'react';
import {
    Clock, FileText, ArrowRight, Zap, BookOpen, Loader2, Target,
    ListChecks, Search, GitBranch, Brain,
} from 'lucide-react';
import api from '../api/client';

const TABS = [
    { id: 'timeline', label: 'Research Timeline', icon: Clock },
    { id: 'systematic', label: 'Systematic Review', icon: GitBranch },
];

function TimelineTab() {
    const [topic, setTopic] = useState('');
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [maxMilestones, setMaxMilestones] = useState(15);
    const [timeline, setTimeline] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/enhancement/timeline', {
                topic,
                start_year: startYear ? parseInt(startYear) : null,
                end_year: endYear ? parseInt(endYear) : null,
                max_milestones: maxMilestones,
            });
            setTimeline(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const categoryColor = (cat) => {
        switch (cat) {
            case 'discovery': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'methodology': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            case 'breakthrough': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'review': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'controversy': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Research Topic</label>
                        <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., CRISPR gene editing in agriculture"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Start Year</label>
                        <input value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="Auto" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">End Year</label>
                        <input value={endYear} onChange={(e) => setEndYear(e.target.value)} placeholder="Current" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Max Milestones</label>
                        <input type="number" value={maxMilestones} onChange={(e) => setMaxMilestones(parseInt(e.target.value) || 15)} min={5} max={30} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white focus:border-indigo-500/50 focus:outline-none" />
                    </div>
                </div>
                <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    {loading ? 'Generating...' : 'Generate Timeline'}
                </button>
            </div>

            {timeline && (
                <div className="space-y-6 animate-slide-up">
                    {/* Summary */}
                    <div className="glass-card p-6 rounded-3xl border border-white/5">
                        <h3 className="text-sm font-bold text-white mb-2">{timeline.topic} — Field Evolution ({timeline.start_year}–{timeline.end_year})</h3>
                        <p className="text-sm text-slate-300">{timeline.summary}</p>
                        {timeline.key_themes?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {timeline.key_themes.map((theme, i) => (
                                    <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-400/10 text-indigo-400 border border-indigo-400/20">{theme}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Timeline Milestones */}
                    <div className="relative">
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/40 via-indigo-500/10 to-transparent" />
                        <div className="space-y-4">
                            {(timeline.milestones || []).map((milestone, i) => (
                                <div key={i} className="flex items-start gap-4 pl-2">
                                    <div className="relative z-10 shrink-0">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                            <span className="text-xs font-bold text-indigo-400">{String(milestone.year).slice(-2)}</span>
                                        </div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border border-white/5 flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-indigo-400">{milestone.year}</span>
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryColor(milestone.category)}`}>
                                                        {milestone.category}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold text-white">{milestone.title}</h4>
                                                <p className="text-xs text-slate-400 mt-1">{milestone.description}</p>
                                            </div>
                                            {milestone.impact_score !== undefined && (
                                                <div className="shrink-0 text-right">
                                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-white">{(milestone.impact_score * 10).toFixed(0)}</span>
                                                    </div>
                                                    <span className="text-[9px] text-slate-600">impact</span>
                                                </div>
                                            )}
                                        </div>
                                        {milestone.key_papers?.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                                {milestone.key_papers.slice(0, 2).map((p, j) => (
                                                    <div key={j} className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <FileText className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{p.title}{p.journal ? ` — ${p.journal}` : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Current Directions */}
                    {timeline.current_directions?.length > 0 && (
                        <div className="glass-card p-6 rounded-3xl border border-white/5">
                            <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Current Research Directions</h3>
                            <div className="space-y-2">
                                {timeline.current_directions.map((d, i) => (
                                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <Zap className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                        <span className="text-sm text-slate-300">{d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested Reading */}
                    {timeline.suggested_reading?.length > 0 && (
                        <div className="glass-card p-6 rounded-3xl border border-white/5">
                            <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Essential Reading</h3>
                            <div className="space-y-2">
                                {timeline.suggested_reading.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                        <span className="text-xs font-bold text-amber-400">{i + 1}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                                            <p className="text-[10px] text-slate-500">{p.authors} {p.journal ? `— ${p.journal}` : ''} {p.year ? `(${p.year})` : ''}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function SystematicReviewTab() {
    const [activeSubTab, setActiveSubTab] = useState('pico');
    const [researchQuestion, setResearchQuestion] = useState('');
    const [picoResult, setPicoResult] = useState(null);
    const [screeningResult, setScreeningResult] = useState(null);
    const [screenPaper, setScreenPaper] = useState({ title: '', abstract: '' });
    const [inclusionCriteria, setInclusionCriteria] = useState([]);
    const [exclusionCriteria, setExclusionCriteria] = useState([]);
    const [screenedPaper, setScreenedPaper] = useState(null);
    const [loading, setLoading] = useState(false);
    const [prismaData, setPrismaData] = useState({
        total_identified: 0,
        duplicates_removed: 0,
        title_screened: 0,
        full_text_assessed: 0,
        studies_included: 0,
    });
    const [prismaResult, setPrismaResult] = useState(null);

    const handleExtractPICO = async () => {
        if (!researchQuestion.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/enhancement/pico-extract', {
                research_question: researchQuestion,
            });
            setPicoResult(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleGenerateCriteria = async () => {
        if (!researchQuestion.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/enhancement/screening-criteria', {
                research_question: researchQuestion,
            });
            setScreeningResult(res.data);
            setInclusionCriteria(res.data.inclusion_criteria || []);
            setExclusionCriteria(res.data.exclusion_criteria || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleScreenPaper = async () => {
        if (!screenPaper.title.trim() || inclusionCriteria.length === 0) return;
        setLoading(true);
        try {
            const res = await api.post('/enhancement/screen-paper', {
                paper_title: screenPaper.title,
                paper_abstract: screenPaper.abstract,
                inclusion_criteria: inclusionCriteria.map(c => c.text || c),
                exclusion_criteria: exclusionCriteria.map(c => c.text || c),
            });
            setScreenedPaper(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handlePRISMA = async () => {
        setLoading(true);
        try {
            const res = await api.post('/enhancement/prisma-flow', prismaData);
            setPrismaResult(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const subTabs = [
        { id: 'pico', label: 'PICO' },
        { id: 'criteria', label: 'Screening Criteria' },
        { id: 'screen', label: 'Screen Papers' },
        { id: 'prisma', label: 'PRISMA Flow' },
    ];

    return (
        <div className="space-y-6">
            {/* Research Question Input */}
            <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Research Question</label>
                <input
                    value={researchQuestion}
                    onChange={(e) => setResearchQuestion(e.target.value)}
                    placeholder="e.g., What is the effectiveness of mobile health interventions on maternal outcomes in Sub-Saharan Africa?"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
                />
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                {subTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeSubTab === tab.id
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* PICO Tab */}
            {activeSubTab === 'pico' && (
                <div className="space-y-4">
                    <button onClick={handleExtractPICO} disabled={loading || !researchQuestion.trim()} className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                        Extract PICO Elements
                    </button>
                    {picoResult && (
                        <div className="glass-card p-6 rounded-3xl border border-white/5 animate-slide-up space-y-4">
                            <h3 className="text-sm font-bold text-white">PICO Elements</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {['population', 'intervention', 'comparison', 'outcome'].map(key => {
                                    const el = picoResult[key];
                                    if (!el) return null;
                                    return (
                                        <div key={key} className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase">{key}</span>
                                            <p className="text-sm text-white mt-1 font-semibold">{el.description || el}</p>
                                            {el.search_terms?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {el.search_terms.map((t, i) => (
                                                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {picoResult.suggested_databases?.length > 0 && (
                                <div className="mt-3">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Suggested Databases</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {picoResult.suggested_databases.map((db, i) => (
                                            <span key={i} className="text-xs px-3 py-1 rounded-full bg-indigo-400/10 text-indigo-400 border border-indigo-400/20">{db}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Screening Criteria Tab */}
            {activeSubTab === 'criteria' && (
                <div className="space-y-4">
                    <button onClick={handleGenerateCriteria} disabled={loading || !researchQuestion.trim()} className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                        Generate Screening Criteria
                    </button>
                    {screeningResult && (
                        <div className="space-y-4 animate-slide-up">
                            <div className="glass-card p-6 rounded-3xl border border-emerald-500/20">
                                <h3 className="text-sm font-bold text-emerald-400 mb-3">Inclusion Criteria</h3>
                                <div className="space-y-2">
                                    {screeningResult.inclusion_criteria?.map((c, i) => (
                                        <div key={i} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <p className="text-sm text-white">{c.text || c}</p>
                                            {c.rationale && <p className="text-[10px] text-slate-500 mt-1">{c.rationale}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="glass-card p-6 rounded-3xl border border-red-500/20">
                                <h3 className="text-sm font-bold text-red-400 mb-3">Exclusion Criteria</h3>
                                <div className="space-y-2">
                                    {screeningResult.exclusion_criteria?.map((c, i) => (
                                        <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                                            <p className="text-sm text-white">{c.text || c}</p>
                                            {c.rationale && <p className="text-[10px] text-slate-500 mt-1">{c.rationale}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {screeningResult.quality_checklist?.length > 0 && (
                                <div className="glass-card p-6 rounded-3xl border border-white/5">
                                    <h3 className="text-sm font-bold text-purple-400 mb-3">Quality Assessment Checklist</h3>
                                    <div className="space-y-2">
                                        {screeningResult.quality_checklist.map((c, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                                <input type="checkbox" className="mt-1 accent-indigo-500" />
                                                <div>
                                                    <p className="text-sm text-white">{c.text || c}</p>
                                                    {c.rationale && <p className="text-[10px] text-slate-500 mt-0.5">{c.rationale}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Screen Papers Tab */}
            {activeSubTab === 'screen' && (
                <div className="space-y-4">
                    <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Paper Title</label>
                            <input
                                value={screenPaper.title}
                                onChange={(e) => setScreenPaper(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Title of the paper to screen"
                                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Abstract</label>
                            <textarea
                                value={screenPaper.abstract}
                                onChange={(e) => setScreenPaper(prev => ({ ...prev, abstract: e.target.value }))}
                                placeholder="Abstract of the paper..."
                                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none resize-none min-h-[80px]"
                            />
                        </div>
                        <button onClick={handleScreenPaper} disabled={loading || !screenPaper.title.trim() || inclusionCriteria.length === 0} className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Screen Paper
                        </button>
                        {inclusionCriteria.length === 0 && (
                            <p className="text-xs text-amber-400/70">Generate screening criteria first (Screening Criteria tab).</p>
                        )}
                    </div>
                    {screenedPaper && (
                        <div className="glass-card p-6 rounded-3xl border border-white/5 animate-slide-up space-y-3">
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${
                                    screenedPaper.decision === 'include' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                                    screenedPaper.decision === 'exclude' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                                    'bg-amber-400/10 text-amber-400 border-amber-400/20'
                                }`}>
                                    {screenedPaper.decision?.toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-500">Confidence: {(screenedPaper.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <p className="text-sm text-slate-300">{screenedPaper.rationale}</p>
                            {screenedPaper.notes && <p className="text-xs text-slate-500 italic">{screenedPaper.notes}</p>}
                        </div>
                    )}
                </div>
            )}

            {/* PRISMA Flow Tab */}
            {activeSubTab === 'prisma' && (
                <div className="space-y-4">
                    <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><GitBranch className="w-4 h-4" /> PRISMA 2020 Flow Data</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[
                                { key: 'total_identified', label: 'Total Identified' },
                                { key: 'duplicates_removed', label: 'Duplicates Removed' },
                                { key: 'title_screened', label: 'Title/Abstract Screened' },
                                { key: 'full_text_assessed', label: 'Full-Text Assessed' },
                                { key: 'studies_included', label: 'Studies Included' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{field.label}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={prismaData[field.key]}
                                        onChange={(e) => setPrismaData(prev => ({ ...prev, [field.key]: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-sm text-white font-mono focus:border-indigo-500/50 focus:outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={handlePRISMA} disabled={loading} className="btn-primary px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                            Generate PRISMA Flow
                        </button>
                    </div>
                    {prismaResult && (
                        <div className="glass-card p-6 rounded-3xl border border-white/5 animate-slide-up">
                            <h3 className="text-sm font-bold text-white mb-4">PRISMA Flow Diagram</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Identification', count: prismaResult.identification?.total_identified, color: 'indigo' },
                                    { label: 'After Duplicate Removal', count: prismaResult.screening?.after_duplicate_removal, color: 'blue' },
                                    { label: 'Screened', count: prismaResult.screening?.records_screened, color: 'cyan' },
                                    { label: 'Full-Text Assessed', count: prismaResult.eligibility?.full_text_assessed, color: 'amber' },
                                    { label: 'Included in Final Review', count: prismaResult.included?.studies_included, color: 'emerald' },
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full bg-${step.color}-500 shrink-0`} />
                                        <div className="flex-1 bg-white/[0.02] rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between">
                                            <span className="text-sm text-slate-300">{step.label}</span>
                                            <span className="text-sm font-bold text-white">{step.count?.toLocaleString()}</span>
                                        </div>
                                        {i < 4 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0 rotate-90" />}
                                    </div>
                                ))}
                            </div>
                            {prismaResult.summary && (
                                <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                    <span className="text-xs font-bold text-indigo-400">Yield: {prismaResult.summary.yield_rate}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ResearchReviewView() {
    const [activeTab, setActiveTab] = useState('timeline');

    return (
        <div className="space-y-8 animate-reveal">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-rose-400/20 rounded-2xl flex items-center justify-center border border-white/10">
                        <Brain className="w-5 h-5 text-amber-400" />
                    </div>
                    Research Review
                </h1>
                <p className="text-sm text-slate-500 mt-2">Trace field evolution and run systematic reviews</p>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                                : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'timeline' && <TimelineTab />}
            {activeTab === 'systematic' && <SystematicReviewTab />}
        </div>
    );
}