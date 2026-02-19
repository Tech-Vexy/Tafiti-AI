import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Quote, BookOpen, ChevronRight, FileText, Printer, Download, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import CitationExportPanel from './CitationExportPanel';

export const SynthesisView = ({ synthesis, papers, isLoading, onClip, language = 'English' }) => {
    if (!synthesis && !isLoading) return null;

    const handleDownload = () => {
        if (!synthesis) return;

        // Extract title from synthesis if it follows the MD format "# Title: ..."
        const titleMatch = synthesis.match(/^# Title:\s*(.*)/m);
        const fileName = titleMatch
            ? titleMatch[1].trim().replace(/[^a-z0-9]/gi, '_').toLowerCase()
            : `research_synthesis_${new Date().toISOString().split('T')[0]}`;

        const blob = new Blob([synthesis], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full glass-card-heavy p-8 mt-12 animate-fade-in relative overflow-hidden">
            {/* AI Glow Effect */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 shadow-[0_0_20px_var(--primary-glow)]" />

            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="text-indigo-400 w-5 h-5 glow-pulse" />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            AI Research Synthesis
                        </h2>
                        {language && language !== 'English' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                <Globe className="w-3 h-3" />
                                {language}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest mt-0.5">
                        Powered by {papers.length} selected sources
                    </p>
                </div>
                {synthesis && !isLoading && (
                    <div className="ml-auto flex items-center gap-3">
                        <button
                            onClick={handleDownload}
                            className="no-print flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-2xl font-bold transition-all active:scale-95 group"
                            title="Download Markdown"
                        >
                            <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                            Download
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="no-print flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-2xl font-bold transition-all active:scale-95 group"
                            title="Print Synthesis"
                        >
                            <Printer className="w-4 h-4 group-hover:rotate-6 transition-transform" />
                            Print
                        </button>
                        <button
                            onClick={() => onClip && onClip(synthesis, papers)}
                            className="no-print flex items-center gap-2 px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl font-bold transition-all active:scale-95 group"
                        >
                            <FileText className="w-4 h-4 group-hover:rotate-6 transition-transform" />
                            Clip to Notes
                        </button>
                    </div>
                )}
            </div>

            <div className="prose prose-invert max-w-none">
                <div className="text-[var(--text-dim)] leading-relaxed text-lg whitespace-pre-wrap">
                    {synthesis ? (
                        <ReactMarkdown
                            components={{
                                p: ({ children }) => <p className="mb-4">{children}</p>,
                                strong: ({ children }) => <strong className="text-indigo-300 font-bold">{children}</strong>,
                            }}
                        >
                            {synthesis}
                        </ReactMarkdown>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                            <p className="text-sm font-medium animate-pulse">Generating synthesis based on selected papers...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sources Attribution */}
            {synthesis && papers.length > 0 && (
                <div className="mt-12 pt-8 border-t border-[var(--border-glass)]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)] mb-6 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Cited Sources
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {papers.map((paper, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/20 transition-all duration-300 group">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">
                                    [{idx + 1}]
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-indigo-400 transition-colors">
                                        {paper.title}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">
                                        {paper.authors[0]} et al. • {paper.year}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Citation Export Panel */}
            {synthesis && papers.length > 0 && (
                <CitationExportPanel papers={papers} />
            )}

            {/* Background Decorative */}
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -z-10" />
        </div>
    );
};
