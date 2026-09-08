import React, { useState } from 'react';
import {
    Sparkles, ChevronDown, ChevronRight, Loader2, Check,
    FileText, List, Wand2, BookOpen, RefreshCw, ArrowRight, Lightbulb,
    Settings, PenLine
} from 'lucide-react';
import api from '../api/client';

const STYLES = [
    { key: 'argumentative', label: 'Argumentative', desc: 'Makes a claim and supports it with evidence' },
    { key: 'expository', label: 'Expository', desc: 'Explains and informs on a topic' },
    { key: 'analytical', label: 'Analytical', desc: 'Breaks down a topic into components for analysis' },
    { key: 'narrative', label: 'Narrative', desc: 'Tells a story to make a point' },
];

const DISCIPLINES = [
    'Computer Science', 'Biology', 'Chemistry', 'Physics', 'Mathematics',
    'Psychology', 'Sociology', 'Economics', 'Political Science', 'History',
    'Philosophy', 'Literature', 'Education', 'Engineering', 'Medicine',
    'Environmental Science', 'Business', 'Law', 'Anthropology', 'Linguistics',
];

/**
 * ThesisOutlineGenerator — AI-powered outline generator panel.
 *
 * Props:
 *   onInsertOutline(text)   — insert generated outline text into the thesis editor
 *   onSetTitle(title)       — update the thesis title
 */
const ThesisOutlineGenerator = ({ onInsertOutline, onSetTitle }) => {
    const [topic, setTopic] = useState('');
    const [discipline, setDiscipline] = useState('');
    const [numSections, setNumSections] = useState(5);
    const [style, setStyle] = useState('argumentative');
    const [showSettings, setShowSettings] = useState(false);

    const [outline, setOutline] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refining, setRefining] = useState(false);
    const [refineInstruction, setRefineInstruction] = useState('');
    const [expandedSections, setExpandedSections] = useState(new Set());
    const [toastMsg, setToastMsg] = useState(null);

    // Generate outline
    const handleGenerate = async () => {
        if (!topic.trim() || topic.trim().length < 5) return;
        setLoading(true);
        setOutline(null);
        try {
            const res = await api.post('/thesis/outline/generate', {
                topic: topic.trim(),
                discipline: discipline || null,
                num_sections: numSections,
                style,
                language: 'English',
                include_page_estimate: true,
            });
            setOutline(res.data);
            // Auto-expand all sections
            setExpandedSections(new Set(res.data.sections.map((_, i) => i)));
        } catch (err) {
            console.error('Outline generation failed:', err);
            showToast('Failed to generate outline — please try again');
        } finally {
            setLoading(false);
        }
    };

    // Refine outline
    const handleRefine = async () => {
        if (!outline || !refineInstruction.trim()) return;
        setRefining(true);
        try {
            const res = await api.post('/thesis/outline/refine', {
                topic: outline.topic || topic,
                current_outline: outline.sections,
                instruction: refineInstruction.trim(),
                language: 'English',
            });
            setOutline(prev => ({ ...prev, ...res.data }));
            setRefineInstruction('');
            if (res.data.changes_summary) {
                showToast(res.data.changes_summary);
            }
        } catch (err) {
            console.error('Outline refinement failed:', err);
            showToast('Failed to refine outline — please try again');
        } finally {
            setRefining(false);
        }
    };

    // Insert outline into thesis
    const handleInsertOutline = () => {
        if (!outline) return;
        const text = formatOutlineAsText(outline);
        if (onInsertOutline) onInsertOutline(text);
        showToast('Outline inserted into thesis');
    };

    // Set thesis title from outline suggestion
    const handleApplyTitle = () => {
        if (!outline?.title_suggestion) return;
        if (onSetTitle) onSetTitle(outline.title_suggestion);
        showToast('Title applied');
    };

    // Format outline as readable text
    const formatOutlineAsText = (data) => {
        let text = '';
        text += `${data.title_suggestion}\n\n`;
        if (data.abstract_suggestion) {
            text += `Abstract\n${data.abstract_suggestion}\n\n`;
        }
        data.sections.forEach((section, i) => {
            text += `${i + 1}. ${section.title}\n`;
            text += `${section.content_suggestion}\n\n`;
            section.subsections.forEach((sub, j) => {
                text += `   ${i + 1}.${j + 1} ${sub.title}\n`;
                text += `   ${sub.content_suggestion}\n\n`;
            });
        });
        if (data.key_questions?.length > 0) {
            text += 'Research Questions\n';
            data.key_questions.forEach(q => { text += `• ${q}\n`; });
            text += '\n';
        }
        if (data.methodology_hint) {
            text += `Suggested Methodology\n${data.methodology_hint}\n`;
        }
        return text;
    };

    const toggleSection = (idx) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const expandAll = () => {
        if (!outline) return;
        setExpandedSections(new Set(outline.sections.map((_, i) => i)));
    };

    const collapseAll = () => setExpandedSections(new Set());

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-black tracking-tight">Thesis Outline</h3>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-sky-500/10 text-sky-400' : 'text-slate-600 hover:text-slate-400'}`}
                    title="Outline settings"
                >
                    <Settings className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Settings Panel (collapsible) */}
            {showSettings && (
                <div className="px-4 py-3 border-b border-white/5 space-y-3 animate-fade-in shrink-0">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block mb-1.5">
                            Discipline
                        </label>
                        <select
                            value={discipline}
                            onChange={(e) => setDiscipline(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-500/30 transition-colors appearance-none"
                        >
                            <option value="">Any discipline</option>
                            {DISCIPLINES.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block mb-1.5">
                            Thesis Style
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {STYLES.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setStyle(s.key)}
                                    className={`p-2 rounded-xl text-left transition-all border ${
                                        style === s.key
                                            ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                            : 'border-transparent hover:bg-white/[0.03] text-slate-500'
                                    }`}
                                >
                                    <div className="text-[10px] font-bold">{s.label}</div>
                                    <div className="text-[9px] text-slate-700 mt-0.5 leading-tight">{s.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block mb-1.5">
                            Number of Sections: {numSections}
                        </label>
                        <input
                            type="range"
                            min={3}
                            max={12}
                            value={numSections}
                            onChange={(e) => setNumSections(parseInt(e.target.value))}
                            className="w-full accent-sky-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-700">
                            <span>3</span>
                            <span>12</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Topic Input */}
            <div className="px-4 py-3 border-b border-white/5 shrink-0">
                <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block mb-1.5">
                    Research Topic
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="e.g., The impact of AI on healthcare diagnostics..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleGenerate(); }}
                        className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-sky-500/30 transition-colors"
                        disabled={loading}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading || topic.trim().length < 5}
                        className="px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                    >
                        {loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Generate
                    </button>
                </div>
            </div>

            {/* Outline Display */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="relative">
                            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                            <Sparkles className="w-4 h-4 text-sky-300 absolute top-0 right-0 animate-pulse" />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Generating your thesis outline...</p>
                        <p className="text-[10px] text-slate-700">This may take 15-30 seconds</p>
                    </div>
                )}

                {!loading && !outline && (
                    <div className="flex flex-col items-center justify-center py-16 px-4 space-y-3">
                        <div className="w-16 h-16 bg-sky-500/5 rounded-2xl flex items-center justify-center">
                            <Lightbulb className="w-8 h-8 text-sky-500/20" />
                        </div>
                        <p className="text-xs text-slate-500 font-medium text-center">Enter a research topic above to generate a structured thesis outline</p>
                        <div className="text-[10px] text-slate-700 text-center space-y-1">
                            <p>The AI will create:</p>
                            <p>• Structured sections & subsections</p>
                            <p>• Content suggestions for each section</p>
                            <p>• Key research questions</p>
                            <p>• Methodology recommendations</p>
                            <p>• Page count estimates</p>
                        </div>
                    </div>
                )}

                {!loading && outline && (
                    <div className="p-4 space-y-4 animate-fade-in">
                        {/* Title Suggestion */}
                        <div className="p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PenLine className="w-3.5 h-3.5 text-sky-400" />
                                    <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Suggested Title</span>
                                </div>
                                <button
                                    onClick={handleApplyTitle}
                                    className="text-[10px] text-sky-400 hover:text-sky-300 font-bold transition-colors flex items-center gap-1"
                                >
                                    <Check className="w-3 h-3" />
                                    Apply
                                </button>
                            </div>
                            <p className="text-sm font-bold text-slate-300 leading-snug">{outline.title_suggestion}</p>
                        </div>

                        {/* Abstract */}
                        {outline.abstract_suggestion && (
                            <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Abstract Draft</span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed italic">{outline.abstract_suggestion}</p>
                            </div>
                        )}

                        {/* Sections */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <List className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                        Sections ({outline.sections.length})
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={expandAll} className="text-[9px] text-slate-700 hover:text-slate-500 transition-colors">Expand all</button>
                                    <span className="text-slate-800">·</span>
                                    <button onClick={collapseAll} className="text-[9px] text-slate-700 hover:text-slate-500 transition-colors">Collapse all</button>
                                </div>
                            </div>

                            {outline.sections.map((section, idx) => (
                                <div key={idx} className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
                                    <button
                                        onClick={() => toggleSection(idx)}
                                        className="w-full flex items-center gap-2 p-3 hover:bg-white/[0.03] transition-colors text-left"
                                    >
                                        {expandedSections.has(idx) ? (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                        )}
                                        <span className="text-[10px] font-bold text-sky-400 shrink-0">{idx + 1}</span>
                                        <span className="text-xs font-bold text-slate-300 flex-1">{section.title}</span>
                                        {section.subsections?.length > 0 && (
                                            <span className="text-[9px] text-slate-700 shrink-0">
                                                {section.subsections.length} sub
                                            </span>
                                        )}
                                    </button>
                                    {expandedSections.has(idx) && (
                                        <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
                                            <p className="text-[11px] text-slate-500 leading-relaxed">{section.content_suggestion}</p>
                                            {section.subsections?.length > 0 && (
                                                <div className="ml-4 space-y-1.5 border-l border-white/5 pl-3">
                                                    {section.subsections.map((sub, j) => (
                                                        <div key={j} className="space-y-0.5">
                                                            <div className="text-[10px] font-bold text-slate-400">
                                                                {idx + 1}.{j + 1} {sub.title}
                                                            </div>
                                                            <p className="text-[10px] text-slate-600 leading-relaxed">{sub.content_suggestion}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Key Questions */}
                        {outline.key_questions?.length > 0 && (
                            <div className="p-4 bg-violet-500/5 rounded-2xl border border-violet-500/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider">Key Research Questions</span>
                                </div>
                                <ul className="space-y-1">
                                    {outline.key_questions.map((q, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                            <span className="text-violet-400 mt-0.5">•</span>
                                            {q}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Methodology */}
                        {outline.methodology_hint && (
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Suggested Methodology</span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">{outline.methodology_hint}</p>
                            </div>
                        )}

                        {/* Page Estimate */}
                        {outline.estimated_total_pages > 0 && (
                            <div className="text-center text-[10px] text-slate-700 py-1">
                                Estimated total: ~{outline.estimated_total_pages} pages
                            </div>
                        )}

                        {/* Refine */}
                        <div className="border-t border-white/5 pt-3 space-y-2">
                            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Refine Outline</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g., Add a chapter on machine learning, expand methodology..."
                                    value={refineInstruction}
                                    onChange={(e) => setRefineInstruction(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !refining) handleRefine(); }}
                                    className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-500/30 transition-colors"
                                    disabled={refining}
                                />
                                <button
                                    onClick={handleRefine}
                                    disabled={refining || !refineInstruction.trim()}
                                    className="px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                                >
                                    {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                    Refine
                                </button>
                            </div>
                        </div>

                        {/* Insert Button */}
                        <button
                            onClick={handleInsertOutline}
                            className="w-full py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-sky-500/20"
                        >
                            <ArrowRight className="w-4 h-4" />
                            Insert Outline into Thesis
                        </button>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toastMsg && (
                <div className="fixed bottom-20 right-6 z-50 animate-slide-up">
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl">
                        <Check className="w-4 h-4 text-sky-400" />
                        <span className="text-sm font-medium text-white">{toastMsg}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThesisOutlineGenerator;
