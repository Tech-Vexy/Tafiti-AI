import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus, Search, FileText, Trash2, Save, Loader2, Calendar,
    Download, ChevronDown, Eye, PenLine, Archive, Send, RotateCcw,
    History, Check, X, Sparkles, Wand2, ArrowRight,
    Expand, Palette, ChevronRight,
    Copy, RefreshCw, SplitSquareHorizontal, Lightbulb, BookOpen
} from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import api from '../api/client';
import CitationPicker from './CitationPicker';
import ThesisOutlineGenerator from './ThesisOutlineGenerator';
import * as Y from 'yjs';
import { YjsThesisProvider, createThesisYjsDoc } from '../lib/yjs-provider';
import { YjsEditorBinding } from '../lib/yjs-editor-binding';

// Syncfusion Document Editor styles — imported here so they resolve from root node_modules
import '@syncfusion/ej2-base/styles/material.css';
import '@syncfusion/ej2-buttons/styles/material.css';
import '@syncfusion/ej2-inputs/styles/material.css';
import '@syncfusion/ej2-popups/styles/material.css';
import '@syncfusion/ej2-lists/styles/material.css';
import '@syncfusion/ej2-navigations/styles/material.css';
import '@syncfusion/ej2-splitbuttons/styles/material.css';
import '@syncfusion/ej2-dropdowns/styles/material.css';
import '@syncfusion/ej2-documenteditor/styles/material.css';

// Lazy-load Syncfusion Document Editor (heavy bundle)
const DocumentEditorContainer = React.lazy(() =>
    import('@syncfusion/ej2-react-documenteditor').then(mod => {
        const { DocumentEditorContainerComponent, Toolbar } = mod;
        DocumentEditorContainerComponent.Inject(Toolbar);
        return { default: DocumentEditorContainerComponent };
    })
);

const STATUS_CONFIG = {
    draft: { label: 'Draft', color: 'text-slate-400 bg-slate-400/10', icon: PenLine },
    in_review: { label: 'In Review', color: 'text-amber-400 bg-amber-400/10', icon: Eye },
    submitted: { label: 'Submitted', color: 'text-emerald-400 bg-emerald-400/10', icon: Send },
    archived: { label: 'Archived', color: 'text-slate-500 bg-slate-500/10', icon: Archive },
};

const WRITING_OPS = [
    { key: 'summarize', label: 'Summarize', icon: Sparkles, color: 'text-blue-400 bg-blue-400/10', desc: 'Condense into concise academic prose' },
    { key: 'clarity', label: 'Improve Clarity', icon: Wand2, color: 'text-violet-400 bg-violet-400/10', desc: 'Rewrite for better readability' },
    { key: 'transitions', label: 'Add Transitions', icon: ArrowRight, color: 'text-emerald-400 bg-emerald-400/10', desc: 'Insert smooth paragraph transitions' },
    { key: 'expand', label: 'Expand', icon: Expand, color: 'text-amber-400 bg-amber-400/10', desc: 'Add detail, examples & analysis' },
    { key: 'style', label: 'Style Check', icon: Palette, color: 'text-rose-400 bg-rose-400/10', desc: 'Review quality & get suggestions' },
];

const ThesisEditor = () => {
    const [theses, setTheses] = useState([]);
    const [activeThesis, setActiveThesis] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [showVersions, setShowVersions] = useState(false);
    const [versions, setVersions] = useState([]);
    const [toastMsg, setToastMsg] = useState(null);
    const [statusFilter, setStatusFilter] = useState(null);

    // Citation picker state
    const [showCitations, setShowCitations] = useState(false);

    // Outline generator state
    const [showOutline, setShowOutline] = useState(false);

    // Yjs CRDT state
    const yjsDocRef = useRef(null);
    const yjsProviderRef = useRef(null);
    const yjsBindingRef = useRef(null);

    // Writing assistant state
    const [showAssistant, setShowAssistant] = useState(false);
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantResult, setAssistantResult] = useState(null);
    const [assistantOp, setAssistantOp] = useState(null);
    const [selectedText, _setSelectedText] = useState('');
    const [showTransitionsPanel, setShowTransitionsPanel] = useState(false);
    const [transitionsParagraphs, setTransitionsParagraphs] = useState(['', '']);
    const [transitionsResult, setTransitionsResult] = useState(null);
    const [transitionsLoading, setTransitionsLoading] = useState(false);

    const { user } = useUser();
    const { getToken } = useAuth();
    const [clerkToken, setClerkToken] = useState(null);

    const editorRef = useRef(null);
    const autoSaveTimer = useRef(null);
    const containerRef = useRef(null);

    // Fetch Clerk JWT for WebSocket auth and init Yjs when ready
    useEffect(() => {
        if (user) {
            getToken().then(t => {
                setClerkToken(t);
                // If a thesis is already loaded, init Yjs now
                if (activeThesis && t) {
                    initYjs(activeThesis.id, activeThesis);
                }
            }).catch(console.error);
        }
    }, [user, getToken, activeThesis?.id, initYjs]);

    // Cleanup Yjs on unmount
    useEffect(() => {
        return () => {
            if (yjsBindingRef.current) yjsBindingRef.current.destroy();
            if (yjsProviderRef.current) {
                yjsProviderRef.current.stopHeartbeat();
                yjsProviderRef.current.disconnect();
            }
            if (yjsDocRef.current) yjsDocRef.current.destroy();
        };
    }, []);

    // Fetch all theses
    const fetchTheses = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (searchQuery) params.search = searchQuery;
            const res = await api.get('/thesis/', { params });
            setTheses(res.data);
            if (res.data.length > 0 && !activeThesis) {
                await selectThesis(res.data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch theses:', err);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, searchQuery]);

    useEffect(() => { fetchTheses(); }, [fetchTheses]);

    // Select and load a thesis
    const selectThesis = async (thesisId) => {
        try {
            // Clean up previous Yjs resources
            if (yjsBindingRef.current) {
                yjsBindingRef.current.destroy();
                yjsBindingRef.current = null;
            }
            if (yjsProviderRef.current) {
                yjsProviderRef.current.stopHeartbeat();
                yjsProviderRef.current.disconnect();
                yjsProviderRef.current = null;
            }
            if (yjsDocRef.current) {
                yjsDocRef.current.destroy();
                yjsDocRef.current = null;
            }

            const res = await api.get(`/thesis/${thesisId}`);
            setActiveThesis(res.data);
            setLastSaved(res.data.last_auto_save_at ? new Date(res.data.last_auto_save_at) : null);

            // Initialize Yjs for this thesis
            if (clerkToken && user) {
                initYjs(thesisId, res.data);
            }
        } catch (err) {
            console.error('Failed to load thesis:', err);
        }
    };

    // Initialize Yjs CRDT for collaborative editing
    const initYjs = useCallback(async (thesisId, thesisData) => {
        try {
            // Create Yjs document
            const { doc, yXmlFragment } = createThesisYjsDoc();
            yjsDocRef.current = doc;

            // Create provider
            const provider = new YjsThesisProvider(thesisId, doc, clerkToken, {
                userId: user?.id,
                displayName: user?.firstName || user?.username || 'Researcher',
                color: '#6366f1',
            });
            yjsProviderRef.current = provider;

            // Connect WebSocket
            provider.connect();
            provider.startHeartbeat(30000);

            // Load initial state from backend
            await provider.loadState(api);

            // If no Yjs state exists yet, push the current SFDT content
            if (thesisData.content && thesisData.content !== '{}') {
                try {
                    const yText = doc.getText('thesis-content-text');
                    if (yText.toString().length === 0) {
                        // First time — push existing content to Yjs
                        doc.transact(() => {
                            yText.insert(0, thesisData.content);
                            const paragraph = new Y.XmlElement('paragraph');
                            paragraph.setAttribute('style', 'Normal');
                            const textNode = new Y.XmlText();
                            textNode.insert(0, thesisData.content);
                            paragraph.push([textNode]);
                            yXmlFragment.push([paragraph]);
                        });
                        const update = Y.encodeStateAsUpdate(doc);
                        provider.sendUpdate(update);
                    }
                } catch (e) {
                    console.warn('[Yjs] Failed to initialize content:', e);
                }
            }

            // Create binding after editor mounts
            // The binding will poll for the editor ref
            setTimeout(() => {
                const binding = new YjsEditorBinding(doc, yXmlFragment, provider, editorRef);
                yjsBindingRef.current = binding;
            }, 500);

        } catch (e) {
            console.error('[Yjs] Failed to initialize:', e);
        }
    }, [clerkToken, user, api]);

    // Create a new thesis
    const handleCreate = async () => {
        try {
            const res = await api.post('/thesis/', {
                title: 'Untitled Thesis',
                content: JSON.stringify({ sections: [{ text: '', style: 'Normal' }] }),
            });
            setTheses([res.data, ...theses]);
            await selectThesis(res.data.id);
            showToast('Thesis created');
        } catch (err) {
            showToast('Failed to create thesis');
        }
    };

    // Auto-save the thesis content
    const handleAutoSave = useCallback(async () => {
        if (!activeThesis || !editorRef.current) return;
        try {
            setIsSaving(true);
            const content = editorRef.current.serialize();
            const plainText = editorRef.current.getText();
            const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
            const res = await api.put(`/thesis/${activeThesis.id}`, {
                content: typeof content === 'string' ? content : JSON.stringify(content),
                plain_text: plainText,
                word_count: wordCount,
            });
            setActiveThesis(prev => ({ ...prev, ...res.data }));
            setLastSaved(new Date());

            // Also persist Yjs CRDT state for conflict resolution
            if (yjsProviderRef.current) {
                yjsProviderRef.current.persistState(api);
            }
        } catch (err) {
            console.error('Auto-save failed:', err);
        } finally {
            setIsSaving(false);
        }
    }, [activeThesis]);

    const typingTimer = useRef(null);

    const handleContentChange = useCallback(() => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => handleAutoSave(), 3000);

        // Send typing indicator via WebSocket
        if (window.__thesisCollab?.sendMessage) {
            window.__thesisCollab.sendMessage({ type: 'typing', is_typing: true });
            // Clear typing after 2s of inactivity
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {
                window.__thesisCollab?.sendMessage({ type: 'typing', is_typing: false });
            }, 2000);
        }
    }, [handleAutoSave]);

    const handleManualSave = async () => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        await handleAutoSave();
        showToast('Saved');
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this thesis? This cannot be undone.')) return;
        try {
            await api.delete(`/thesis/${id}`);
            setTheses(theses.filter(t => t.id !== id));
            if (activeThesis?.id === id) {
                const remaining = theses.filter(t => t.id !== id);
                if (remaining.length > 0) await selectThesis(remaining[0].id);
                else setActiveThesis(null);
            }
            showToast('Thesis deleted');
        } catch (err) {
            showToast('Failed to delete thesis');
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!activeThesis) return;
        try {
            const res = await api.put(`/thesis/${activeThesis.id}`, { status: newStatus });
            setActiveThesis(res.data);
            setTheses(theses.map(t => t.id === activeThesis.id ? { ...t, status: newStatus } : t));
            showToast(`Status changed to ${STATUS_CONFIG[newStatus]?.label}`);
        } catch (err) {
            showToast('Failed to update status');
        }
    };

    const loadVersions = async () => {
        if (!activeThesis) return;
        try {
            const res = await api.get(`/thesis/${activeThesis.id}/versions`);
            setVersions(res.data.versions || []);
            setShowVersions(true);
        } catch (err) {
            showToast('Failed to load versions');
        }
    };

    const handleRestore = async (versionNumber) => {
        if (!activeThesis) return;
        try {
            const res = await api.post(`/thesis/${activeThesis.id}/restore/${versionNumber}`);
            setActiveThesis(res.data);
            setShowVersions(false);
            showToast(`Restored to version ${versionNumber}`);
        } catch (err) {
            showToast('Failed to restore version');
        }
    };

    const handleExport = async (format) => {
        if (!activeThesis) return;
        try {
            const res = await api.post(`/thesis/${activeThesis.id}/export?format=${format}`);
            const blob = new Blob([res.data.content], {
                type: format === 'txt' ? 'text/plain' : format === 'html' ? 'text/html' : 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeThesis.title || 'thesis'}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`Exported as .${format}`);
        } catch (err) {
            showToast('Export failed');
        }
    };

    const handleSnapshot = async () => {
        if (!activeThesis) return;
        try {
            const res = await api.post(`/thesis/${activeThesis.id}/snapshot`);
            setActiveThesis(res.data);
            showToast('Version snapshot saved');
        } catch (err) {
            showToast('Failed to save snapshot');
        }
    };

    const handleTitleChange = async (newTitle) => {
        if (!activeThesis) return;
        setActiveThesis(prev => ({ ...prev, title: newTitle }));
        try {
            await api.put(`/thesis/${activeThesis.id}`, { title: newTitle });
            setTheses(theses.map(t => t.id === activeThesis.id ? { ...t, title: newTitle } : t));
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    };

    // --- Writing Assistant Functions ---

    const getSelectedText = useCallback(() => {
        // Try to get selected text from Syncfusion editor
        if (editorRef.current) {
            try {
                const sel = editorRef.current.getSelection();
                if (sel && sel.text && sel.text.trim().length > 0) {
                    return sel.text;
                }
            } catch (e) {
                // Syncfusion selection API may vary
            }
            // Fallback: get all text
            try {
                return editorRef.current.getText() || '';
            } catch (e) {
                return '';
            }
        }
        return '';
    }, []);

    const runWritingOp = useCallback(async (operation) => {
        const text = selectedText || getSelectedText();
        if (!text || text.trim().length < 10) {
            showToast('Select some text first (minimum 10 characters)');
            return;
        }

        setAssistantLoading(true);
        setAssistantOp(operation);
        setAssistantResult(null);
        setShowAssistant(true);

        try {
            if (operation === 'transitions') {
                // Split text into paragraphs and use transitions-between endpoint
                const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                if (paragraphs.length < 2) {
                    // Use the regular transitions endpoint instead
                    const res = await api.post('/thesis/assist/transitions', {
                        text,
                        context: activeThesis?.title || '',
                    });
                    setAssistantResult({
                        type: 'clarity',
                        original: text,
                        result: res.data.result,
                        wordCountBefore: res.data.word_count_before,
                        wordCountAfter: res.data.word_count_after,
                    });
                } else {
                    const res = await api.post('/thesis/assist/transitions-between', {
                        paragraphs,
                        context: activeThesis?.title || '',
                    });
                    setAssistantResult({
                        type: 'transitions',
                        original: text,
                        result: res.data.full_text,
                        transitions: res.data.transitions,
                        suggestions: res.data.suggestions,
                    });
                }
            } else {
                const res = await api.post(`/thesis/assist/${operation}`, {
                    text,
                    context: activeThesis?.title || '',
                });
                setAssistantResult({
                    type: operation,
                    original: text,
                    result: res.data.result,
                    wordCountBefore: res.data.word_count_before,
                    wordCountAfter: res.data.word_count_after,
                });
            }
        } catch (err) {
            console.error(`Writing assist ${operation} failed:`, err);
            showToast(`AI ${operation} failed — please try again`);
            setAssistantResult(null);
        } finally {
            setAssistantLoading(false);
        }
    }, [selectedText, getSelectedText, activeThesis]);

    const applyResultToEditor = useCallback(() => {
        if (!assistantResult || !editorRef.current) return;
        try {
            // Replace selected text with the AI result
            editorRef.current.replaceSelection(assistantResult.result);
            showToast('Applied to document');
            handleContentChange();
        } catch (e) {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(assistantResult.result);
            showToast('Copied to clipboard (select text and paste)');
        }
    }, [assistantResult, handleContentChange]);

    const copyResultToClipboard = useCallback(() => {
        if (!assistantResult) return;
        navigator.clipboard.writeText(assistantResult.result);
        showToast('Copied to clipboard');
    }, [assistantResult]);

    // Transitions between paragraphs
    const handleTransitionsBetween = async () => {
        const validParagraphs = transitionsParagraphs.filter(p => p.trim().length > 0);
        if (validParagraphs.length < 2) {
            showToast('Add at least 2 paragraphs');
            return;
        }
        setTransitionsLoading(true);
        try {
            const res = await api.post('/thesis/assist/transitions-between', {
                paragraphs: validParagraphs,
                context: activeThesis?.title || '',
            });
            setTransitionsResult(res.data);
        } catch (err) {
            showToast('Failed to generate transitions');
        } finally {
            setTransitionsLoading(false);
        }
    };

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    const filteredTheses = theses.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const currentStatus = activeThesis ? (STATUS_CONFIG[activeThesis.status] || STATUS_CONFIG.draft) : STATUS_CONFIG.draft;
    const StatusIcon = currentStatus.icon;

    return (
        <div className="flex h-[calc(100vh-8rem)] animate-reveal overflow-hidden bg-white/[0.02] rounded-3xl border border-white/5">
            {/* Sidebar — Thesis List */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-white/[0.01]">
                <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-400" />
                            Thesis Editor
                        </h2>
                        <button
                            onClick={handleCreate}
                            className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all active:scale-95"
                            title="New thesis"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search theses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/30 transition-colors"
                        />
                    </div>
                    {/* Status filter pills */}
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setStatusFilter(null)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${!statusFilter ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            All
                        </button>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${statusFilter === key ? cfg.color + ' border border-current/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        </div>
                    ) : filteredTheses.length > 0 ? (
                        filteredTheses.map(thesis => {
                            const cfg = STATUS_CONFIG[thesis.status] || STATUS_CONFIG.draft;
                            const ThesisStatusIcon = cfg.icon;
                            return (
                                <div
                                    key={thesis.id}
                                    onClick={() => selectThesis(thesis.id)}
                                    className={`p-3.5 rounded-2xl cursor-pointer transition-all border group ${activeThesis?.id === thesis.id
                                        ? 'bg-indigo-500/10 border-indigo-500/20'
                                        : 'bg-transparent border-transparent hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className={`font-bold text-sm line-clamp-2 leading-tight ${activeThesis?.id === thesis.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                                            {thesis.title || 'Untitled Thesis'}
                                        </h3>
                                        <button
                                            onClick={(e) => handleDelete(thesis.id, e)}
                                            className="p-1 hover:text-rose-400 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${cfg.color}`}>
                                                <ThesisStatusIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                            <span>{thesis.word_count?.toLocaleString() || 0} words</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-1.5">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {formatTimeAgo(thesis.updated_at)}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 px-4">
                            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm font-medium mb-3">
                                {searchQuery ? 'No theses match your search' : 'No theses yet'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={handleCreate}
                                    className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors"
                                >
                                    Create your first thesis →
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col bg-transparent">
                {activeThesis ? (
                    <>
                        {/* Top bar */}
                        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={activeThesis.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="bg-transparent text-lg font-black tracking-tight focus:outline-none w-full max-w-md placeholder:text-slate-700 truncate"
                                    placeholder="Thesis Title"
                                />
                                {isSaving && (
                                    <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold animate-pulse shrink-0">
                                        <Save className="w-3 h-3" />
                                        Saving...
                                    </div>
                                )}
                                {!isSaving && lastSaved && (
                                    <span className="text-[10px] text-slate-600 shrink-0">
                                        Saved {formatTimeAgo(lastSaved.toISOString())}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Outline Generator Toggle */}
                                <button
                                    onClick={() => { setShowOutline(!showOutline); if (showAssistant) setShowAssistant(false); if (showCitations) setShowCitations(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-bold ${
                                        showOutline
                                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400'
                                    }`}
                                    title="AI Thesis Outline Generator"
                                >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    Outline
                                </button>

                                {/* Citation Picker Toggle */}
                                <button
                                    onClick={() => { setShowCitations(!showCitations); if (showAssistant) setShowAssistant(false); if (showOutline) setShowOutline(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-bold ${
                                        showCitations
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400'
                                    }`}
                                    title="Citations & Bibliography"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Cite
                                </button>

                                {/* Writing Assistant Toggle */}
                                <button
                                    onClick={() => { setShowAssistant(!showAssistant); if (showCitations) setShowCitations(false); if (showOutline) setShowOutline(false); }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-bold ${
                                        showAssistant
                                            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400'
                                    }`}
                                    title="AI Writing Assistant"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI Assist
                                </button>

                                {/* Status selector */}
                                <div className="relative group">
                                    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${currentStatus.color} border border-current/10 transition-all`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {currentStatus.label}
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                    <div className="absolute right-0 mt-1 w-40 bg-[#0d0d12] border border-white/10 rounded-xl shadow-2xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                            const SIcon = cfg.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => handleStatusChange(key)}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${activeThesis.status === key ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    <SIcon className="w-3 h-3" />
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button onClick={loadVersions} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all text-xs font-bold" title="Version History">
                                    <History className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={handleSnapshot} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all text-xs font-bold" title="Save Snapshot">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={handleManualSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all text-xs font-bold">
                                    <Save className="w-3.5 h-3.5" />
                                    Save
                                </button>

                                {/* Export dropdown */}
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all text-xs font-bold">
                                        <Download className="w-3.5 h-3.5" />
                                        Export
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                    <div className="absolute right-0 mt-1 w-32 bg-[#0d0d12] border border-white/10 rounded-xl shadow-2xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        {['docx', 'txt', 'html', 'md'].map(fmt => (
                                            <button
                                                key={fmt}
                                                onClick={() => handleExport(fmt)}
                                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors uppercase"
                                            >
                                                .{fmt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-600 font-medium px-2 py-1 bg-white/5 rounded-lg">
                                    {(activeThesis.word_count || 0).toLocaleString()} words
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Syncfusion Document Editor */}
                            <div ref={containerRef} className="flex-1 overflow-hidden">
                                <React.Suspense fallback={
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                    </div>
                                }>
                                    <DocumentEditorContainerComponent
                                        id="documenteditor-container"
                                        ref={editorRef}
                                        height="100%"
                                        enableToolbar={true}
                                        serviceUrl="https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/"
                                        style={{ marginTop: 0 }}
                                        contentChange={() => handleContentChange()}
                                        toolbarItems={[
                                            'New', 'Open', 'Separator',
                                            'Undo', 'Redo', 'Separator',
                                            'Font', 'FontSize', 'FontColor', 'ClearColor', 'Separator',
                                            'Bold', 'Italic', 'Underline', 'StrikeThrough', 'Superscript', 'Subscript', 'Separator',
                                            'AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify', 'Separator',
                                            'Bullets', 'Numbering', 'Separator',
                                            'Indent', 'Outdent', 'Separator',
                                            'Styles', 'Separator',
                                            'Paragraph', 'Spacing', 'Separator',
                                            'Find', 'Separator',
                                            'Table', 'Separator',
                                            'Header', 'Footer', 'PageSetup', 'Separator',
                                            'InsertTable', 'TableProperties', 'Separator',
                                            'InsertLink', 'InsertBookmark', 'InsertHyperlink',
                                        ]}
                                    />
                                </React.Suspense>
                            </div>

                            {/* Outline Generator Panel */}
                            {showOutline && (
                                <div className="w-96 border-l border-white/5 bg-white/[0.01] flex flex-col overflow-hidden animate-slide-in-right">
                                    <ThesisOutlineGenerator
                                        onInsertOutline={(text) => {
                                            if (editorRef.current) {
                                                try {
                                                    editorRef.current.replaceSelection(text);
                                                } catch (e) {
                                                    navigator.clipboard.writeText(text);
                                                }
                                            }
                                            handleContentChange();
                                        }}
                                        onSetTitle={(title) => {
                                            handleTitleChange(title);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Citation Picker Panel */}
                            {showCitations && (
                                <div className="w-96 border-l border-white/5 bg-white/[0.01] flex flex-col overflow-hidden animate-slide-in-right">
                                    <CitationPicker
                                        editorRef={editorRef}
                                        onInsertInline={(text) => {
                                            if (editorRef.current) {
                                                try {
                                                    editorRef.current.replaceSelection(text);
                                                } catch (e) {
                                                    navigator.clipboard.writeText(text);
                                                }
                                            }
                                            handleContentChange();
                                        }}
                                        onInsertReference={(text) => {
                                            if (editorRef.current) {
                                                try {
                                                    editorRef.current.replaceSelection(text);
                                                } catch (e) {
                                                    navigator.clipboard.writeText(text);
                                                }
                                            }
                                            handleContentChange();
                                        }}
                                        onInsertBibliography={(text) => {
                                            if (editorRef.current) {
                                                try {
                                                    // Insert at the end
                                                    const allText = editorRef.current.getText() || '';
                                                    const separator = allText.trim().endsWith('\n\n') ? '' : '\n\n';
                                                    editorRef.current.replaceSelection(separator + text);
                                                } catch (e) {
                                                    navigator.clipboard.writeText(text);
                                                }
                                            }
                                            handleContentChange();
                                        }}
                                    />
                                </div>
                            )}

                            {/* Writing Assistant Panel */}
                            {showAssistant && (
                                <div className="w-96 border-l border-white/5 bg-white/[0.01] flex flex-col overflow-hidden animate-slide-in-right">
                                    {/* Panel Header */}
                                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-violet-400" />
                                            <h3 className="text-sm font-black tracking-tight">AI Writing Assistant</h3>
                                        </div>
                                        <button
                                            onClick={() => { setShowAssistant(false); setAssistantResult(null); }}
                                            className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4 text-slate-500" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                        {/* Quick Actions */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Quick Actions</p>
                                            <p className="text-[10px] text-slate-600">
                                                Select text in the editor, then click an action below.
                                                If no text is selected, the full document will be used.
                                            </p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {WRITING_OPS.map(op => (
                                                    <button
                                                        key={op.key}
                                                        onClick={() => runWritingOp(op.key)}
                                                        disabled={assistantLoading}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all text-left group ${assistantLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.03]'}`}
                                                    >
                                                        <div className={`p-2 rounded-lg ${op.color} shrink-0`}>
                                                            <op.icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{op.label}</div>
                                                            <div className="text-[10px] text-slate-600 truncate">{op.desc}</div>
                                                        </div>
                                                        {assistantLoading && assistantOp === op.key && (
                                                            <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0 ml-auto" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Transitions Between Paragraphs */}
                                        <div className="space-y-2 pt-2 border-t border-white/5">
                                            <button
                                                onClick={() => setShowTransitionsPanel(!showTransitionsPanel)}
                                                className="flex items-center gap-2 w-full text-left group"
                                            >
                                                <SplitSquareHorizontal className="w-4 h-4 text-emerald-400" />
                                                <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Transitions Between Paragraphs</span>
                                                <ChevronRight className={`w-3 h-3 text-slate-600 ml-auto transition-transform ${showTransitionsPanel ? 'rotate-90' : ''}`} />
                                            </button>
                                            {showTransitionsPanel && (
                                                <div className="space-y-3 animate-fade-in">
                                                    <p className="text-[10px] text-slate-600">
                                                        Paste paragraphs below (separated by blank lines) and get smooth transitions between them.
                                                    </p>
                                                    {transitionsParagraphs.map((para, idx) => (
                                                        <div key={idx} className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-slate-500">Paragraph {idx + 1}</span>
                                                                {transitionsParagraphs.length > 2 && (
                                                                    <button
                                                                        onClick={() => setTransitionsParagraphs(transitionsParagraphs.filter((_, i) => i !== idx))}
                                                                        className="text-[10px] text-rose-400 hover:text-rose-300"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <textarea
                                                                value={para}
                                                                onChange={(e) => {
                                                                    const newParas = [...transitionsParagraphs];
                                                                    newParas[idx] = e.target.value;
                                                                    setTransitionsParagraphs(newParas);
                                                                }}
                                                                placeholder={`Paragraph ${idx + 1}...`}
                                                                rows={3}
                                                                className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/30 resize-none transition-colors"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setTransitionsParagraphs([...transitionsParagraphs, ''])}
                                                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-all"
                                                        >
                                                            + Add Paragraph
                                                        </button>
                                                        <button
                                                            onClick={handleTransitionsBetween}
                                                            disabled={transitionsLoading}
                                                            className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            {transitionsLoading ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <ArrowRight className="w-3 h-3" />
                                                            )}
                                                            Generate Transitions
                                                        </button>
                                                    </div>

                                                    {transitionsResult && (
                                                        <div className="space-y-3 animate-fade-in">
                                                            <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-3">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                                                                    <span className="text-xs font-bold text-emerald-400">Transitions Generated</span>
                                                                </div>
                                                                {transitionsResult.transitions.map((t, i) => (
                                                                    <div key={i} className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                                                        <span className="text-[10px] font-bold text-emerald-400 mb-1 block">Between ¶{i + 1} and ¶{i + 2}</span>
                                                                        <p className="text-xs text-slate-300 italic">{t}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                                                <p className="text-[10px] font-bold text-slate-500 mb-2">Full Text with Transitions</p>
                                                                <div className="text-xs text-slate-400 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                                                                    {transitionsResult.full_text}
                                                                </div>
                                                            </div>
                                                            {transitionsResult.suggestions && (
                                                                <div className="p-4 bg-violet-500/5 rounded-2xl border border-violet-500/10">
                                                                    <p className="text-[10px] font-bold text-violet-400 mb-2">Tips</p>
                                                                    <ul className="space-y-1">
                                                                        {transitionsResult.suggestions.map((s, i) => (
                                                                            <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                                                                                <span className="text-violet-400 mt-0.5">•</span>
                                                                                {s}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(transitionsResult.full_text);
                                                                        showToast('Copied to clipboard');
                                                                    }}
                                                                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                    Copy Full Text
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        try {
                                                                            editorRef.current?.replaceSelection(transitionsResult.full_text);
                                                                            showToast('Applied to document');
                                                                        } catch (e) {
                                                                            navigator.clipboard.writeText(transitionsResult.full_text);
                                                                            showToast('Copied — paste manually');
                                                                        }
                                                                    }}
                                                                    className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    Apply to Document
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* AI Result Display */}
                                        {assistantResult && (
                                            <div className="space-y-3 pt-2 border-t border-white/5 animate-fade-in">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4 text-violet-400" />
                                                        <span className="text-xs font-bold text-violet-400">
                                                            {WRITING_OPS.find(o => o.key === assistantResult.type)?.label || assistantResult.type}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setAssistantResult(null)}
                                                        className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-3 h-3 text-slate-600" />
                                                    </button>
                                                </div>

                                                {/* Word count comparison */}
                                                {assistantResult.wordCountBefore > 0 && (
                                                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                                        <span>{assistantResult.wordCountBefore.toLocaleString()} words before</span>
                                                        {assistantResult.wordCountAfter > 0 && (
                                                            <>
                                                                <ArrowRight className="w-3 h-3" />
                                                                <span>{assistantResult.wordCountAfter.toLocaleString()} words after</span>
                                                                <span className={`font-bold ${assistantResult.wordCountAfter > assistantResult.wordCountBefore ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                    ({assistantResult.wordCountAfter > assistantResult.wordCountBefore ? '+' : ''}{assistantResult.wordCountAfter - assistantResult.wordCountBefore})
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Result content */}
                                                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                                                        {assistantResult.result}
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={copyResultToClipboard}
                                                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                        Copy
                                                    </button>
                                                    <button
                                                        onClick={applyResultToEditor}
                                                        className="flex-1 py-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        Apply to Document
                                                    </button>
                                                    <button
                                                        onClick={() => runWritingOp(assistantResult.type)}
                                                        className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                                                        title="Re-run"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                {/* Original text comparison */}
                                                {assistantResult.original && (
                                                    <details className="group">
                                                        <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">
                                                            Show original text
                                                        </summary>
                                                        <div className="mt-2 p-3 bg-white/[0.02] rounded-xl border border-white/5 text-[10px] text-slate-500 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                                            {assistantResult.original}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                        <div className="w-20 h-20 bg-indigo-500/5 rounded-3xl flex items-center justify-center">
                            <FileText className="w-10 h-10 text-indigo-500/20" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white/50">
                            Start writing your thesis
                        </h3>
                        <p className="text-sm text-slate-600 max-w-md">
                            Create a new thesis to begin writing with a full-featured word processor.
                            Your work is auto-saved and versioned.
                        </p>
                        <button onClick={handleCreate} className="btn-primary text-sm">
                            <Plus className="w-4 h-4 inline mr-2" />
                            New Thesis
                        </button>
                    </div>
                )}
            </div>

            {/* Version History Panel */}
            {showVersions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVersions(false)} />
                    <div className="relative bg-[#0d0d12] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-lg font-black">Version History</h3>
                            </div>
                            <button onClick={() => setShowVersions(false)} className="text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[50vh] p-4 space-y-2">
                            {versions.length > 0 ? (
                                [...versions].reverse().map((v, _idx) => (
                                    <div key={v.version} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all group">
                                        <div>
                                            <div className="text-sm font-bold text-slate-300">Version {v.version}</div>
                                            <div className="text-[10px] text-slate-600 mt-0.5">
                                                {formatDate(v.created_at)} · {v.word_count?.toLocaleString() || 0} words
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestore(v.version)}
                                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-600 text-sm">No versions saved yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notification */}
            {toastMsg && (
                <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-white">{toastMsg}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThesisEditor;
