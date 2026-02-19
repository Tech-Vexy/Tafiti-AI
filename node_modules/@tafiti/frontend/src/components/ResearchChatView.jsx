import React, { useState, useRef, useEffect } from 'react';
import {
    Send, Sparkles, BookOpen, Layers,
    X, ChevronRight, MessageSquare,
    Database, Quote, Loader2, Library,
    Copy, CheckCircle2, ListFilter
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ResearchChatView = ({
    savedPapers,
    onSendMessage,
    onUploadFile,
    isUploading,
    uploadedFiles,
    onRemoveUpload,
    isLoading,
    messages,
    isCollaborative,
    setIsCollaborative,
    followupQuestions = []
}) => {
    const [input, setInput] = useState('');
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [selectedSources, setSelectedSources] = useState([]);
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        onSendMessage(input, selectedSources);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSend(e);
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onUploadFile(file);
        }
    };

    const toggleSource = (paperId) => {
        setSelectedSources(prev =>
            prev.includes(paperId)
                ? prev.filter(id => id !== paperId)
                : [...prev, paperId]
        );
    };

    return (
        <div className="flex flex-col h-[80vh] glass-card-heavy border-white/5 relative overflow-hidden animate-reveal">
            {/* Top Bar: Source Management */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-black text-white">Research Assistant</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Conversational Grounding</p>
                            {uploadedFiles.length > 0 && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded-full uppercase tracking-tighter">
                                    {uploadedFiles.length} Uploads
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                        Upload PDF
                    </button>

                    <button
                        onClick={() => setShowSourceSelector(!showSourceSelector)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedSources.length > 0
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                            }`}
                    >
                        <Layers className="w-4 h-4" />
                        {selectedSources.length} Papers
                    </button>

                    <button
                        onClick={() => setIsCollaborative(!isCollaborative)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isCollaborative
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                            }`}
                    >
                        <Sparkles className={`w-4 h-4 ${isCollaborative ? 'animate-pulse' : ''}`} />
                        {isCollaborative ? 'Collaborative AI ON' : 'Single AI Mode'}
                    </button>

                    {selectedSources.length > 0 && (
                        <button
                            onClick={() => setSelectedSources([])}
                            className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Messages List */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide pb-32"
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xl font-bold">Start Your Inquiry</h4>
                                <p className="text-sm max-w-xs mx-auto leading-relaxed">
                                    Upload PDFs or select papers from your library to ground the AI's knowledge.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`p-6 rounded-3xl ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white font-medium shadow-xl shadow-indigo-500/20'
                                        : 'glass-card border-white/10 text-slate-200'
                                        }`}>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown
                                                components={{
                                                    strong: ({ children }) => <span className="text-indigo-400 font-bold">{children}</span>,
                                                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                            {msg.role === 'user' ? 'You' : 'Assistant'}
                                        </span>
                                        {msg.role === 'assistant' && (
                                            <button
                                                onClick={() => handleCopy(msg.content, i)}
                                                className="p-1 hover:bg-white/5 rounded transition-all text-slate-600 hover:text-indigo-400 flex items-center gap-1"
                                                title="Copy to clipboard"
                                            >
                                                {copiedIndex === i ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                <span className="text-[8px] font-black uppercase tracking-tighter">{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="glass-card p-6 rounded-3xl border-white/10 flex items-center gap-4">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Synthesizing...</span>
                            </div>
                        </div>
                    )}

                    {!isLoading && followupQuestions && followupQuestions.length > 0 && (
                        <div className="flex flex-col gap-3 animate-slide-in-up">
                            <div className="flex items-center gap-2">
                                <ListFilter className="w-3 h-3 text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Follow-up Suggestions</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {followupQuestions.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onSendMessage(q, selectedSources)}
                                        className="px-4 py-2 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 hover:border-indigo-500/30 rounded-xl text-xs text-indigo-300 transition-all text-left max-w-sm"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Side Source Selector Panel */}
                {showSourceSelector && (
                    <div className="w-80 border-l border-white/5 bg-white/2 backdrop-blur-xl absolute right-0 top-0 h-full z-30 transition-all animate-slide-in-right">
                        <div className="p-6 h-full flex flex-col">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Library className="w-3 h-3" /> Select Grounds
                            </h4>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {savedPapers.map(paper => (
                                    <button
                                        key={paper.id}
                                        onClick={() => toggleSource(paper.paper_id)}
                                        className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedSources.includes(paper.paper_id)
                                            ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <p className="text-xs font-bold line-clamp-2">{paper.title}</p>
                                        <p className="text-[10px] opacity-60 mt-1">{paper.authors[0]} • {paper.year}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Input Area */}
            <div className="p-6 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent pt-10">
                <form
                    onSubmit={handleSend}
                    className="max-w-4xl mx-auto relative group"
                >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity blur" />
                    <div className="relative flex items-center bg-[var(--bg-main)] rounded-2xl border border-white/10 focus-within:border-indigo-500/50 transition-all p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={selectedSources.length > 0 || uploadedFiles.length > 0 ? "Ask about your grounded sources..." : "Ask a research question..."}
                            className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-white placeholder-slate-500 font-medium"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-indigo-500 text-white rounded-xl hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/40"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    {(selectedSources.length > 0 || uploadedFiles.length > 0) && (
                        <div className="absolute -top-12 left-0 flex gap-2 overflow-x-auto max-w-full pb-2 scrollbar-hide">
                            {selectedSources.map(id => {
                                const paper = savedPapers.find(p => p.paper_id === id);
                                return (
                                    <div key={id} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-400 flex items-center gap-2 whitespace-nowrap">
                                        <Quote className="w-2.5 h-2.5 opacity-50" />
                                        {paper?.authors[0]}
                                    </div>
                                );
                            })}
                            {uploadedFiles.map((file, idx) => (
                                <div key={idx} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 flex items-center gap-2 whitespace-nowrap group/tag relative">
                                    <Database className="w-2.5 h-2.5 opacity-50" />
                                    {file.filename}
                                    <button
                                        type="button"
                                        onClick={() => onRemoveUpload(idx)}
                                        className="hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}; export default ResearchChatView;
