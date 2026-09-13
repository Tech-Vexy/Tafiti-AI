'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
    Plus,
    X,
    FileText,
    Loader2,
    ArrowUp,
    Mic,
    MicOff,
    Trash2,
    ChevronDown,
    Check,
    Globe,
    Cpu,
    Activity,
    Sprout,
    TrendingUp,
    Atom,
    Users,
    Scale,
} from 'lucide-react';
import { RESEARCH_FIELDS, getFieldById, getSuggestionsForField } from './researchFields';
import useResearchStore from '@/store/useResearchStore';

interface ResearchPromptBoxProps {
    input: string;
    setInput: (val: string | ((prev: string) => string)) => void;
    onSend: (text: string) => void;
    isLoading: boolean;
    researchMode?: 'synthesis' | 'search' | 'table';
    setResearchMode?: (mode: 'synthesis' | 'search' | 'table') => void;
    latencyMode?: 'fast' | 'auto' | 'deep';
    setLatencyMode?: (mode: 'fast' | 'auto' | 'deep') => void;
    uploadedFiles?: { filename: string }[];
    onRemoveUpload?: (idx: number) => void;
    onOpenGroundingDrawer?: () => void;
    isCompact?: boolean;
    selectedField?: string;
    onSelectField?: (fieldId: string) => void;
}

export function renderFieldIcon(iconName: string, className: string = 'w-3.5 h-3.5') {
    switch (iconName) {
        case 'Cpu': return <Cpu className={className} />;
        case 'Activity': return <Activity className={className} />;
        case 'Sprout': return <Sprout className={className} />;
        case 'TrendingUp': return <TrendingUp className={className} />;
        case 'Atom': return <Atom className={className} />;
        case 'Users': return <Users className={className} />;
        case 'Scale': return <Scale className={className} />;
        case 'Globe':
        default:
            return <Globe className={className} />;
    }
}

export default function ResearchPromptBox({
    input,
    setInput,
    onSend,
    isLoading,
    uploadedFiles = [],
    onRemoveUpload,
    onOpenGroundingDrawer,
    isCompact = false,
    researchMode = 'synthesis',
    setResearchMode,
    latencyMode = 'deep',
    setLatencyMode,
    selectedField,
    onSelectField,
}: ResearchPromptBoxProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const compactFieldDropdownRef = useRef<HTMLDivElement>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'paper' | 'file'; idx: number } | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
    const [micStatusMessage, setMicStatusMessage] = useState<string | null>(null);
    const [isCompactFieldOpen, setIsCompactFieldOpen] = useState(false);

    // Active research field resolution
    const storeDomainScope = useResearchStore((s) => s.domainScope);
    const storeSetDomainScope = useResearchStore((s) => s.setDomainScope);

    const activeFieldId = selectedField || storeDomainScope || 'all';
    const currentField = getFieldById(activeFieldId);
    const fieldSuggestions = getSuggestionsForField(activeFieldId);

    const handleSelectField = (fieldId: string) => {
        storeSetDomainScope(fieldId);
        onSelectField?.(fieldId);
        setIsCompactFieldOpen(false);
    };

    // Animated search suggestions state (ONLY for initial search screen, NEVER for compact/previous chats)
    const [suggestionIdx, setSuggestionIdx] = useState(0);
    const [subIdx, setSubIdx] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // Reset typewriter whenever the active research field changes
    useEffect(() => {
        setSuggestionIdx(0);
        setSubIdx(0);
        setIsDeleting(false);
        setIsPaused(false);
    }, [activeFieldId]);

    useEffect(() => {
        // No animating input area in previous chats or when compact
        if (isCompact || input.length > 0 || isLoading) return;

        const currentWord = fieldSuggestions[suggestionIdx] || fieldSuggestions[0] || 'Ask a research question or topic...';

        if (isPaused) {
            const pauseTimer = setTimeout(() => {
                setIsPaused(false);
                setIsDeleting(true);
            }, 2600);
            return () => clearTimeout(pauseTimer);
        }

        if (isDeleting) {
            if (subIdx === 0) {
                setIsDeleting(false);
                setSuggestionIdx((prev) => (prev + 1) % fieldSuggestions.length);
                return;
            }
            const deleteTimer = setTimeout(() => {
                setSubIdx((prev) => prev - 1);
            }, 16);
            return () => clearTimeout(deleteTimer);
        } else {
            if (subIdx === currentWord.length) {
                setIsPaused(true);
                return;
            }
            const typeTimer = setTimeout(() => {
                setSubIdx((prev) => prev + 1);
            }, 36);
            return () => clearTimeout(typeTimer);
        }
    }, [subIdx, isDeleting, isPaused, suggestionIdx, input, isLoading, isCompact, fieldSuggestions]);

    const placeholderText = isCompact
        ? 'Ask a follow-up'
        : (input.length > 0 ? '' : (fieldSuggestions[suggestionIdx]?.substring(0, subIdx) || ''));

    // Track microphone permission state if Permissions API is supported
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
            navigator.permissions
                .query({ name: 'microphone' as PermissionName })
                .then((status) => {
                    setMicPermission(status.state as any);
                    status.onchange = () => {
                        setMicPermission(status.state as any);
                        if (status.state === 'granted') {
                            setMicStatusMessage(null);
                        }
                    };
                })
                .catch(() => {});
        }
    }, []);

    const stopListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {}
            recognitionRef.current = null;
        }
        if (mediaStreamRef.current) {
            try {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            } catch {}
            mediaStreamRef.current = null;
        }
        setIsListening(false);
    };

    // Cleanup recognition and active media tracks on unmount
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            // After a large paste the caret sits at the end; keep it in view
            // once the box reaches its height cap.
            const el = textareaRef.current;
            if (document.activeElement === el && el.selectionStart === el.value.length) {
                el.scrollTop = el.scrollHeight;
            }
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab' && !input && fieldSuggestions[suggestionIdx]) {
            e.preventDefault();
            const suggestion = fieldSuggestions[suggestionIdx]
                .replace(/^e\.g\.\s*"?/, '')
                .replace(/^Ask a research question or topic\.\.\./, '')
                .replace(/"?\s*$/, '');
            if (suggestion) {
                setInput(suggestion);
            }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                stopListening();
                onSend(input);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            stopListening();
            onSend(input);
        }
    };

    // Explicitly triggers the browser's native microphone permission prompt
    const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
        setMicStatusMessage(null);
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setMicStatusMessage('Microphone access is not supported by your browser.');
            return null;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            setMicPermission('granted');
            setMicStatusMessage(null);
            return stream;
        } catch (err: any) {
            console.warn('[Microphone] Permission request result:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setMicPermission('denied');
                setMicStatusMessage('Microphone access was denied. Please allow microphone access in your browser address bar.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setMicPermission('denied');
                setMicStatusMessage('No microphone hardware detected on this device.');
            } else {
                setMicStatusMessage(`Microphone error: ${err.message || 'Access failed'}`);
            }
            return null;
        }
    };

    const handleVoiceToggle = async () => {
        if (isListening) {
            stopListening();
            return;
        }

        // 1. Proactively prompt and request microphone hardware permission first
        const stream = await requestMicrophoneAccess();
        if (!stream) {
            return;
        }

        // 2. Initialize Speech Recognition engine
        const SpeechRecognition =
            typeof window !== 'undefined'
                ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                : null;

        if (!SpeechRecognition) {
            setMicStatusMessage('Microphone active! (Speech-to-text transcription requires Chrome, Edge, Brave, or Safari).');
            setIsListening(true);
            return;
        }

        try {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';

            const baseInput = input.trim();

            rec.onstart = () => {
                setIsListening(true);
            };

            rec.onresult = (event: any) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }
                const spoken = final || interim;
                if (spoken) {
                    setInput(baseInput ? `${baseInput} ${spoken}` : spoken);
                }
            };

            rec.onerror = (event: any) => {
                console.warn('[SpeechRecognition] error:', event.error);
                if (event.error === 'not-allowed') {
                    setMicPermission('denied');
                    setMicStatusMessage('Microphone permission blocked. Please allow microphone access in your browser address bar.');
                }
                stopListening();
            };

            rec.onend = () => {
                stopListening();
            };

            recognitionRef.current = rec;
            rec.start();
            setIsListening(true);
        } catch (err: any) {
            console.error('Speech recognition start error:', err);
            stopListening();
            setMicStatusMessage('Microphone access ready, but speech recognition could not start.');
        }
    };

    const handleRemoveClick = (idx: number) => {
        setDeleteConfirm({ type: 'file', idx });
    };

    const handleConfirmDelete = () => {
        if (deleteConfirm) {
            onRemoveUpload?.(deleteConfirm.idx);
            setDeleteConfirm(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteConfirm(null);
    };

    // Close delete confirmation and field dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (deleteConfirm) {
                const target = event.target as HTMLElement;
                if (!target.closest('.group')) {
                    setDeleteConfirm(null);
                }
            }
            if (isCompactFieldOpen && compactFieldDropdownRef.current && !compactFieldDropdownRef.current.contains(event.target as Node)) {
                setIsCompactFieldOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [deleteConfirm, isCompactFieldOpen]);

    return (
        <div className="w-full max-w-2xl lg:max-w-3xl mx-auto transition-all duration-200">
            {/* Microphone Status / Permission Notice */}
            {micStatusMessage && (
                <div className="mb-2 px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-glass)] text-xs flex items-center justify-between gap-3 shadow-lg animate-fade-in text-[var(--text-main)] backdrop-blur-md">
                    <div className="flex items-center gap-2 truncate">
                        <MicOff className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{micStatusMessage}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {micPermission === 'denied' && (
                            <button
                                type="button"
                                onClick={requestMicrophoneAccess}
                                className="px-2.5 py-1 rounded-full bg-[var(--btn-surface)] hover:bg-[var(--sidebar-hover)] text-[var(--text-main)] text-[11px] font-medium transition-colors border border-[var(--border-glass)]"
                            >
                                Request Permission
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setMicStatusMessage(null)}
                            className="p-1 hover:text-[var(--text-main)] rounded-full transition-colors text-[var(--text-muted)]"
                            aria-label="Dismiss microphone notification"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
            {/* Minimalist Rounded Box with Floating Controls */}
            <form
                onSubmit={handleSubmit}
                className="relative rounded-2xl border border-[var(--prompt-box-border)] bg-[var(--prompt-box-bg)] focus-within:border-[var(--border-focus)] transition-all shadow-lg backdrop-blur-xl p-3 sm:px-4 sm:pt-3.5 duration-200 ease-out pb-14 text-[var(--text-main)]"
            >
                {/* Active Uploaded Files (Only shows when user attaches files, NEVER previous research sources) */}
                {uploadedFiles.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-b border-[var(--border-glass)] scrollbar-none">
                        {uploadedFiles.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--btn-surface)] border border-[var(--border-glass)] text-[var(--text-main)] text-[11px] font-medium whitespace-nowrap group relative"
                            >
                                <FileText className="w-2.5 h-2.5 text-emerald-400" />
                                <span className="max-w-[150px] truncate">{file.filename}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveClick(idx)}
                                    className="hover:text-rose-400 p-0.5 rounded-full transition-colors"
                                    aria-label={`Remove uploaded file: ${file.filename}`}
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                                
                                {/* Delete Confirmation Popover */}
                                {deleteConfirm?.idx === idx && (
                                    <div className="absolute top-full mt-2 left-0 right-0 p-2 bg-[var(--bg-elevated)] border border-[var(--border-glass)] rounded-lg shadow-xl z-50 animate-fade-in">
                                        <p className="text-[10px] text-[var(--text-main)] mb-2">Remove this file?</p>
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={handleConfirmDelete}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-rose-500/20 text-rose-300 rounded text-[10px] hover:bg-rose-500/30 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Remove
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelDelete}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-[var(--btn-surface)] text-[var(--text-main)] rounded text-[10px] hover:bg-[var(--sidebar-hover)] transition-colors border border-[var(--border-glass)]"
                                            >
                                                <X className="w-3 h-3" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Adaptive Textarea */}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={placeholderText}
                    rows={isCompact ? 1 : 2}
                    className="w-full bg-transparent border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none resize-none text-[var(--text-main)] placeholder:text-[var(--text-muted)] text-sm sm:text-base font-normal leading-relaxed px-1 min-h-[38px] max-h-[200px]"
                    style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                />

                {/* Controls Bar in Input Area */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
                    {isCompact ? (
                        /* Follow-up controls: + Attach icon and Discipline Pill on left, Mic + Send on right */
                        <>
                            {/* Left: + Attach icon & Discipline selector */}
                            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={onOpenGroundingDrawer}
                                    className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors"
                                    title={uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s) attached` : 'Attach file'}
                                    aria-label="Attach file"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {/* Compact Field Selector Pill */}
                                <div className="relative" ref={compactFieldDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCompactFieldOpen(!isCompactFieldOpen)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all border border-[var(--border-glass)] bg-[var(--btn-surface)] text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]"
                                        title={`Active discipline: ${currentField.label}`}
                                        aria-label="Select research discipline"
                                    >
                                        {renderFieldIcon(currentField.icon, `w-3 h-3 ${currentField.color}`)}
                                        <span className="max-w-[90px] truncate hidden xs:inline">{currentField.shortLabel}</span>
                                        <ChevronDown className={`w-2.5 h-2.5 text-[var(--text-muted)] transition-transform duration-200 ${isCompactFieldOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isCompactFieldOpen && (
                                        <div className="absolute bottom-full mb-2 left-0 w-60 max-h-64 overflow-y-auto p-1.5 bg-[var(--bg-elevated)] border border-[var(--border-glass)] rounded-xl shadow-2xl z-50 backdrop-blur-xl animate-fade-in space-y-0.5 custom-scrollbar">
                                            <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                                Research Discipline
                                            </div>
                                            {RESEARCH_FIELDS.map((field) => (
                                                <button
                                                    key={field.id}
                                                    type="button"
                                                    onClick={() => handleSelectField(field.id)}
                                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                                        activeFieldId === field.id
                                                            ? 'bg-[var(--sidebar-hover)] text-[var(--text-main)] font-semibold'
                                                            : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--btn-surface)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        {renderFieldIcon(field.icon, `w-3.5 h-3.5 ${field.color} shrink-0`)}
                                                        <span className="truncate">{field.label}</span>
                                                    </div>
                                                    {activeFieldId === field.id && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Mic, Submit */}
                            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleVoiceToggle}
                                    disabled={isLoading}
                                    className={`p-1.5 rounded-full transition-colors ${
                                        isListening
                                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                                             : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'
                                    }`}
                                    title={isListening ? 'Stop voice input' : 'Voice input'}
                                    aria-label="Voice input"
                                >
                                    {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
                                </button>

                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="w-8 h-8 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 disabled:hover:scale-100 shrink-0 font-bold border-0 outline-none"
                                    title="Submit follow-up"
                                    aria-label={isLoading ? 'Submitting follow-up' : !input.trim() ? 'Enter a question' : 'Submit follow-up'}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-current" />
                                    ) : (
                                        <ArrowUp className="w-4 h-4 text-current stroke-[2.5]" />
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Initial / Landing Page Controls */
                        <>
                            {/* Left: Floating Attach Button */}
                            <div className="flex items-center gap-1.5 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={onOpenGroundingDrawer}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border border-[var(--border-glass)] bg-[var(--btn-surface)] text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]"
                                    aria-label={uploadedFiles.length > 0 ? `Manage ${uploadedFiles.length} attached file(s)` : 'Attach file'}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{uploadedFiles.length > 0 ? `${uploadedFiles.length} attached` : 'Attach'}</span>
                                </button>
                            </div>

                            {/* Right: Floating Voice + Send Buttons */}
                            <div className="flex items-center gap-1.5 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleVoiceToggle}
                                    disabled={isLoading}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border border-[var(--border-glass)] bg-[var(--btn-surface)] ${
                                        isListening
                                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                                            : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)]'
                                    }`}
                                    title={isListening ? 'Stop voice input' : 'Voice input (Microphone)'}
                                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                                >
                                    {isListening ? (
                                        <MicOff className="w-4 h-4 text-rose-400" />
                                    ) : (
                                        <Mic className="w-4 h-4" />
                                    )}
                                </button>

                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="w-8 h-8 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 flex items-center justify-center transition-all shadow-md disabled:shadow-none hover:scale-105 active:scale-95 disabled:hover:scale-100 shrink-0 font-bold border-0 outline-none"
                                    title="Search"
                                    aria-label={isLoading ? 'Research in progress' : !input.trim() ? 'Enter a query to search' : 'Submit research query'}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-current" />
                                    ) : (
                                        <ArrowUp className="w-4 h-4 text-current stroke-[2.5]" />
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
