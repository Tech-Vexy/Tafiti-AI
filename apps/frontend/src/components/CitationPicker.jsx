import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen, Search, Check, X, Copy, FileText, ChevronDown,
    Loader2, Plus, ListOrdered, Quote, ArrowRight, AlertCircle
} from 'lucide-react';
import api from '../api/client';

const STYLES = [
    { key: 'apa', label: 'APA 7th', desc: 'American Psychological Association' },
    { key: 'mla', label: 'MLA 9th', desc: 'Modern Language Association' },
    { key: 'chicago', label: 'Chicago', desc: 'Chicago Manual of Style' },
    { key: 'harvard', label: 'Harvard', desc: 'Harvard referencing' },
    { key: 'vancouver', label: 'Vancouver', desc: 'Biomedical numbered style' },
    { key: 'ieee', label: 'IEEE', desc: 'Institute of Electrical Engineers' },
];

/**
 * CitationPicker — a side panel that lets users search their library,
 * select papers, preview formatted citations, and insert them into the thesis.
 *
 * Props:
 *   onInsertInline(citationText)  — insert "(Author, Year)" at cursor
 *   onInsertReference(refText)    — insert a full reference at cursor
 *   onInsertBibliography(text)    — insert a full bibliography at cursor
 *   editorRef                     — ref to the Syncfusion DocumentEditor
 */
const CitationPicker = ({ onInsertInline, onInsertReference, onInsertBibliography, editorRef }) => {
    const [papers, setPapers] = useState([]);
    const [filteredPapers, setFilteredPapers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPapers, setSelectedPapers] = useState(new Set());
    const [citationStyle, setCitationStyle] = useState('apa');
    const [showStyleDropdown, setShowStyleDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const [mode, setMode] = useState('picker'); // 'picker' | 'bibliography'
    const [bibliography, setBibliography] = useState(null);
    const [bibLoading, setBibLoading] = useState(false);

    const searchTimer = useRef(null);

    // Fetch user's saved papers
    const fetchPapers = useCallback(async (query = '') => {
        setIsLoading(true);
        try {
            const params = query ? { q: query } : {};
            const res = await api.get('/thesis/sources', { params });
            setPapers(res.data);
            setFilteredPapers(res.data);
        } catch (err) {
            console.error('Failed to fetch papers:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchPapers(); }, [fetchPapers]);

    // Search filter (debounced server search for >2 chars, local filter otherwise)
    const handleSearch = useCallback((value) => {
        setSearchQuery(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);

        if (value.length > 2) {
            searchTimer.current = setTimeout(() => fetchPapers(value), 300);
        } else {
            // Local filter
            const lower = value.toLowerCase();
            setFilteredPapers(
                papers.filter(p =>
                    p.title.toLowerCase().includes(lower) ||
                    (p.authors || []).some(a => a.toLowerCase().includes(lower))
                )
            );
        }
    }, [papers, fetchPapers]);

    const togglePaper = (paperId) => {
        setSelectedPapers(prev => {
            const next = new Set(prev);
            if (next.has(paperId)) next.delete(paperId);
            else next.add(paperId);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedPapers.size === filteredPapers.length) {
            setSelectedPapers(new Set());
        } else {
            setSelectedPapers(new Set(filteredPapers.map(p => p.paper_id)));
        }
    };

    // Preview formatted citations for selected papers
    const handlePreview = async () => {
        if (selectedPapers.size === 0) return;
        setPreviewLoading(true);
        try {
            const res = await api.post('/thesis/format', {
                paper_ids: Array.from(selectedPapers),
                style: citationStyle,
            });
            setPreview(res.data);
        } catch (err) {
            showToast('Failed to format citations');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Generate full bibliography
    const handleBibliography = async () => {
        if (selectedPapers.size === 0) return;
        setBibLoading(true);
        try {
            const res = await api.post('/thesis/bibliography', {
                paper_ids: Array.from(selectedPapers),
                style: citationStyle,
                sort_by: 'author',
            });
            setBibliography(res.data);
        } catch (err) {
            showToast('Failed to generate bibliography');
        } finally {
            setBibLoading(false);
        }
    };

    // Insert a single inline citation
    const handleInsertInline = async (paperId) => {
        try {
            const res = await api.post('/thesis/format-inline', {
                paper_id: paperId,
                style: citationStyle,
            });
            if (onInsertInline) onInsertInline(res.data.inline);
            showToast(`Inserted: ${res.data.inline}`);
        } catch (err) {
            showToast('Failed to format inline citation');
        }
    };

    // Insert the preview results into editor
    const handleInsertPreview = () => {
        if (!preview) return;
        const text = preview.citations.map(c => c.formatted).join('\n\n');
        if (onInsertReference) onInsertReference(text);
        showToast(`Inserted ${preview.count} reference(s)`);
    };

    // Insert bibliography
    const handleInsertBibliography = () => {
        if (!bibliography) return;
        if (onInsertBibliography) onInsertBibliography(bibliography.bibliography);
        showToast(`Inserted bibliography (${bibliography.count} sources)`);
    };

    // Copy to clipboard
    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
    };

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    const currentStyle = STYLES.find(s => s.key === citationStyle) || STYLES[0];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-black tracking-tight">Citations</h3>
                    {selectedPapers.size > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] font-bold">
                            {selectedPapers.size} selected
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setMode('picker'); setPreview(null); setBibliography(null); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${mode === 'picker' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        <Quote className="w-3 h-3 inline mr-1" />
                        Pick
                    </button>
                    <button
                        onClick={() => { setMode('bibliography'); setPreview(null); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${mode === 'bibliography' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                        <ListOrdered className="w-3 h-3 inline mr-1" />
                        Bibliography
                    </button>
                </div>
            </div>

            {/* Style Selector */}
            <div className="px-4 py-2 border-b border-white/5 shrink-0">
                <div className="relative">
                    <button
                        onClick={() => setShowStyleDropdown(!showStyleDropdown)}
                        className="flex items-center gap-2 w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 transition-all"
                    >
                        <span className="text-amber-400">{currentStyle.label}</span>
                        <span className="text-slate-600 font-normal truncate">{currentStyle.desc}</span>
                        <ChevronDown className="w-3 h-3 text-slate-600 ml-auto shrink-0" />
                    </button>
                    {showStyleDropdown && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowStyleDropdown(false)} />
                            <div className="absolute left-0 right-0 mt-1 bg-[#0d0d12] border border-white/10 rounded-xl shadow-2xl py-1 z-50 max-h-60 overflow-y-auto">
                                {STYLES.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => { setCitationStyle(s.key); setShowStyleDropdown(false); setPreview(null); setBibliography(null); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${citationStyle === s.key ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <span className="font-bold w-16 text-left">{s.label}</span>
                                        <span className="text-slate-600 font-normal">{s.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input
                        type="text"
                        placeholder="Search your library..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-amber-500/30 transition-colors"
                    />
                </div>
            </div>

            {/* Select All */}
            {filteredPapers.length > 0 && (
                <div className="px-4 py-1 shrink-0">
                    <button
                        onClick={selectAll}
                        className="text-[10px] text-slate-600 hover:text-slate-400 font-bold transition-colors"
                    >
                        {selectedPapers.size === filteredPapers.length ? 'Deselect all' : 'Select all'} ({filteredPapers.length})
                    </button>
                </div>
            )}

            {/* Paper List */}
            <div className="flex-1 overflow-y-auto px-3 pb-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    </div>
                ) : filteredPapers.length > 0 ? (
                    <div className="space-y-1">
                        {filteredPapers.map(paper => {
                            const isSelected = selectedPapers.has(paper.paper_id);
                            return (
                                <div
                                    key={paper.paper_id}
                                    onClick={() => togglePaper(paper.paper_id)}
                                    className={`p-3 rounded-xl cursor-pointer transition-all border group ${
                                        isSelected
                                            ? 'bg-amber-500/5 border-amber-500/20'
                                            : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                            isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-700'
                                        }`}>
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-bold text-slate-300 line-clamp-2 leading-tight">
                                                {paper.title}
                                            </h4>
                                            <div className="text-[10px] text-slate-600 mt-1">
                                                {(paper.authors || []).slice(0, 3).join(', ')}
                                                {(paper.authors || []).length > 3 && ' et al.'}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                {paper.year && (
                                                    <span className="text-[10px] text-slate-600">{paper.year}</span>
                                                )}
                                                {paper.citations > 0 && (
                                                    <span className="text-[10px] text-slate-600">
                                                        {paper.citations.toLocaleString()} cited by
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Quick inline insert button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleInsertInline(paper.paper_id); }}
                                            className="p-1.5 bg-white/5 hover:bg-amber-500/10 text-slate-600 hover:text-amber-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                            title="Insert inline citation"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <BookOpen className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-600">
                            {searchQuery ? 'No papers match your search' : 'No saved papers yet'}
                        </p>
                        <p className="text-[10px] text-slate-700 mt-1">
                            Save papers from the Discover or Library views to cite them here.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            {selectedPapers.size > 0 && (
                <div className="px-4 py-3 border-t border-white/5 space-y-2 shrink-0">
                    {mode === 'picker' ? (
                        <>
                            <button
                                onClick={handlePreview}
                                disabled={previewLoading}
                                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                                {previewLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Quote className="w-3.5 h-3.5" />
                                )}
                                Preview {selectedPapers.size} citation{selectedPapers.size > 1 ? 's' : ''}
                            </button>
                            {preview && (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                                        {preview.citations.map((c, i) => (
                                            <div key={i} className="text-xs text-slate-300 leading-relaxed mb-2 last:mb-0">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="text-[10px] text-slate-600 font-bold w-4">{i + 1}.</span>
                                                    {c.formatted}
                                                </span>
                                                <div className="flex gap-1 mt-1 ml-5">
                                                    <button
                                                        onClick={() => handleCopy(c.formatted)}
                                                        className="text-[9px] text-slate-600 hover:text-amber-400 transition-colors"
                                                    >
                                                        <Copy className="w-2.5 h-2.5 inline mr-0.5" />
                                                        Copy
                                                    </button>
                                                    <button
                                                        onClick={() => { if (onInsertReference) onInsertReference(c.formatted); showToast('Inserted'); }}
                                                        className="text-[9px] text-slate-600 hover:text-amber-400 transition-colors"
                                                    >
                                                        <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                                                        Insert
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleInsertPreview}
                                        className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <ArrowRight className="w-3 h-3" />
                                        Insert All References
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleBibliography}
                                disabled={bibLoading}
                                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                                {bibLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ListOrdered className="w-3.5 h-3.5" />
                                )}
                                Generate Bibliography
                            </button>
                            {bibliography && (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                                        <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {bibliography.bibliography}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCopy(bibliography.bibliography)}
                                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" />
                                            Copy
                                        </button>
                                        <button
                                            onClick={handleInsertBibliography}
                                            className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Insert
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Toast */}
            {toastMsg && (
                <div className="fixed bottom-20 right-6 z-50 animate-slide-up">
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl">
                        <Check className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-white">{toastMsg}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CitationPicker;
