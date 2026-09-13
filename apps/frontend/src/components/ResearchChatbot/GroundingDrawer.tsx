'use client';

import React, { useRef } from 'react';
import { X, Upload, Bookmark, Layers, Check, FileText, Loader2, Trash2 } from 'lucide-react';
import { ResearchPaper } from './SourceCardsCarousel';

interface GroundingDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    libraryPapers: ResearchPaper[];
    groundedPapers: ResearchPaper[];
    onTogglePaperGround: (paper: ResearchPaper) => void;
    uploadedFiles: { filename: string; extracted_text?: string; storage_path?: string }[];
    onUploadFile: (file: File) => Promise<boolean>;
    onRemoveUpload: (index: number) => void;
    isUploading: boolean;
}

export default function GroundingDrawer({
    isOpen,
    onClose,
    libraryPapers = [],
    groundedPapers = [],
    onTogglePaperGround,
    uploadedFiles = [],
    onUploadFile,
    onRemoveUpload,
    isUploading = false,
}: GroundingDrawerProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onUploadFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const isPaperGrounded = (paper: ResearchPaper) => {
        const id = paper.paper_id || paper.id;
        return groundedPapers.some((p) => (p.paper_id || p.id) === id);
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md h-full bg-[var(--bg-elevated)] border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl animate-slide-in-right overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-[var(--text-main)]">Grounding Sources</h3>
                                <p className="text-xs text-slate-400">Attach papers & PDFs for conversational grounding</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Upload PDF Button */}
                    <div className="pt-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-dashed border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 text-sky-300 font-bold text-xs transition-all disabled:opacity-50 group"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                    <span>Extracting text from PDF...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 text-sky-400 group-hover:-translate-y-0.5 transition-transform" />
                                    <span>Upload Research Paper PDF</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Uploaded Documents</h5>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {uploadedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate font-medium">{file.filename}</span>
                                        </div>
                                        <button
                                            onClick={() => onRemoveUpload(idx)}
                                            className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                            title="Remove upload"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Library Papers Selection */}
                <div className="flex-1 overflow-hidden flex flex-col mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <Bookmark className="w-3 h-3 text-sky-400" />
                            From Your Library ({libraryPapers.length})
                        </h5>
                        <span className="text-[10px] text-slate-500 font-semibold">
                            {groundedPapers.length} selected
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar no-scrollbar scrollbar-none">
                        {libraryPapers.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 space-y-1">
                                <p className="text-xs font-semibold">No saved papers in library.</p>
                                <p className="text-[11px]">Save papers from Discover or Search to ground here.</p>
                            </div>
                        ) : (
                            libraryPapers.map((paper) => {
                                const selected = isPaperGrounded(paper);
                                return (
                                    <button
                                        key={paper.paper_id || paper.id}
                                        onClick={() => onTogglePaperGround(paper)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                            selected
                                                ? 'bg-sky-500/15 border-sky-500/40 text-white shadow-sm'
                                                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                                        }`}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <p className="text-xs font-bold line-clamp-2 leading-snug">{paper.title}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {Array.isArray(paper.authors) ? paper.authors[0] : paper.authors} {paper.year ? `• ${paper.year}` : ''}
                                            </p>
                                        </div>
                                        <div
                                            className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                                                selected
                                                    ? 'bg-sky-500 border-sky-500 text-white'
                                                    : 'border-white/20 bg-white/5'
                                            }`}
                                        >
                                            {selected && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                        {groundedPapers.length + uploadedFiles.length} total source grounds
                    </span>
                    <button
                        onClick={onClose}
                        className="btn-primary px-5 py-2 text-xs font-bold"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
