import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    FileText,
    Trash2,
    Save,
    Clock,
    Tag as TagIcon,
    ChevronRight,
    Loader2,
    Calendar,
    ChevronLeft,
    Monitor,
    Layout as LayoutIcon,
    Edit3,
    BookOpen,
    Download,
    Printer
} from 'lucide-react';
import api from '../api/client';

const NotesView = ({ onRestore }) => {
    const [notes, setNotes] = useState([]);
    const [activeNote, setActiveNote] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState('split'); // 'edit', 'preview', 'split'

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            setIsLoading(true);
            const res = await api.get('/notes/');
            setNotes(res.data);
            if (res.data.length > 0 && !activeNote) {
                setActiveNote(res.data[0]);
            }
        } catch (err) {
            console.error('Failed to fetch notes:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNote = async (initialData = {}) => {
        try {
            const res = await api.post('/notes/', {
                title: initialData.title || 'Untitled Note',
                content: initialData.content || '',
                tags: initialData.tags || []
            });
            setNotes([res.data, ...notes]);
            setActiveNote(res.data);
            return res.data;
        } catch (err) {
            console.error('Failed to create note:', err);
        }
    };

    const handleUpdateNote = async (updatedFields) => {
        if (!activeNote) return;

        const updatedNote = { ...activeNote, ...updatedFields };
        setActiveNote(updatedNote);

        // Optimistic update in list
        setNotes(notes.map(n => n.id === activeNote.id ? updatedNote : n));

        // Simple saving
        setIsSaving(true);
        try {
            await api.put(`/notes/${activeNote.id}`, updatedFields);
        } catch (err) {
            console.error('Failed to save note:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this note?')) return;

        try {
            await api.delete(`/notes/${id}`);
            const remainingNotes = notes.filter(n => n.id !== id);
            setNotes(remainingNotes);
            if (activeNote?.id === id) {
                setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null);
            }
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    };

    const filteredNotes = notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const handleExport = () => {
        if (!activeNote) return;
        const element = document.createElement("a");
        const file = new Blob([activeNote.content], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = `${activeNote.title || 'note'}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="flex h-full animate-reveal overflow-hidden bg-white/5 rounded-3xl border border-white/5">
            {/* Sidebar */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-white/[0.02] no-print">
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-400" />
                            Notes
                        </h2>
                        <button
                            onClick={() => handleCreateNote()}
                            className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/30 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        </div>
                    ) : filteredNotes.length > 0 ? (
                        filteredNotes.map(note => (
                            <div
                                key={note.id}
                                onClick={() => setActiveNote(note)}
                                className={`p-4 rounded-2xl cursor-pointer transition-all border group ${activeNote?.id === note.id ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h3 className={`font-bold text-sm truncate ${activeNote?.id === note.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                                        {note.title || 'Untitled Note'}
                                    </h3>
                                    <button
                                        onClick={(e) => handleDeleteNote(note.id, e)}
                                        className="p-1 hover:text-rose-400 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                                    {note.content || 'No content yet...'}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(note.created_at)}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 px-4">
                            <p className="text-slate-500 text-sm font-medium">No notes found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col bg-transparent print-content">
                {activeNote ? (
                    <>
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex-1 flex items-center gap-4">
                                <input
                                    type="text"
                                    value={activeNote.title}
                                    onChange={(e) => handleUpdateNote({ title: e.target.value })}
                                    className="bg-transparent text-2xl font-black tracking-tight focus:outline-none w-full placeholder:text-slate-700"
                                    placeholder="Note Title"
                                />
                                {isSaving && (
                                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold animate-pulse">
                                        <Save className="w-3 h-3" />
                                        Saving...
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 no-print">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl transition-all text-xs font-bold"
                                    title="Print Note"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all text-xs font-bold"
                                >
                                    <Download className="w-4 h-4" />
                                    Export
                                </button>
                                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                                    <button
                                        onClick={() => setViewMode('edit')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'edit' ? 'bg-indigo-500/20 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('split')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'split' ? 'bg-indigo-500/20 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <LayoutIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('preview')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'preview' ? 'bg-indigo-500/20 text-indigo-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <BookOpen className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {(viewMode === 'edit' || viewMode === 'split') && (
                                <div className={`flex-1 flex flex-col ${viewMode === 'split' ? 'border-r border-white/5' : ''}`}>
                                    <textarea
                                        value={activeNote.content}
                                        onChange={(e) => handleUpdateNote({ content: e.target.value })}
                                        className="flex-1 p-8 bg-transparent focus:outline-none resize-none font-mono text-sm leading-relaxed text-slate-300 placeholder:text-slate-700"
                                        placeholder="Start writing..."
                                    />
                                </div>
                            )}
                            {(viewMode === 'preview' || viewMode === 'split') && (
                                <div className="flex-1 overflow-y-auto p-8 prose prose-invert max-w-none prose-indigo">
                                    <div className="text-slate-300 whitespace-pre-wrap font-sans">
                                        {activeNote.content || <p className="text-slate-600 italic">No content to preview.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                        <div className="w-20 h-20 bg-indigo-500/5 rounded-3xl flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-indigo-500/20" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white/50">Select or create a note</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesView;
