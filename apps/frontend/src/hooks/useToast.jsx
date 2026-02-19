/**
 * Lightweight toast notification system.
 * Wrap your app with <ToastProvider>; consume with useToast().
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Paper saved!');
 *   toast.error('Failed to load data.');
 *   toast.info('Synthesis started…');
 *   toast.warn('Select at least one paper.');
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const add = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev.slice(-4), { id, message, type }]); // max 5
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }
        return id;
    }, [dismiss]);

    const api = {
        success: (msg, dur) => add(msg, 'success', dur),
        error:   (msg, dur) => add(msg, 'error', dur ?? 6000),
        info:    (msg, dur) => add(msg, 'info', dur),
        warn:    (msg, dur) => add(msg, 'warn', dur),
        dismiss,
    };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
};

// ── Toast UI ──────────────────────────────────────────────────────────────────

const STYLES = {
    success: {
        bar:  'bg-emerald-500',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
        border: 'border-emerald-500/20',
        text: 'text-emerald-100',
    },
    error: {
        bar:  'bg-red-500',
        icon: <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
        border: 'border-red-500/20',
        text: 'text-red-100',
    },
    info: {
        bar:  'bg-indigo-500',
        icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
        border: 'border-indigo-500/20',
        text: 'text-indigo-100',
    },
    warn: {
        bar:  'bg-amber-500',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
        border: 'border-amber-500/20',
        text: 'text-amber-100',
    },
};

const ToastItem = ({ toast, onDismiss }) => {
    const s = STYLES[toast.type] || STYLES.info;
    return (
        <div
            className={`
                relative flex items-start gap-3 min-w-[280px] max-w-sm
                bg-[#0d1117] border ${s.border} rounded-2xl px-4 py-3.5
                shadow-2xl shadow-black/60 backdrop-blur-xl
                animate-slide-up
            `}
            role="alert"
        >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-3 bottom-3 w-0.5 ${s.bar} rounded-full`} />

            {s.icon}

            <p className={`text-sm font-medium leading-snug flex-1 ${s.text}`}>
                {toast.message}
            </p>

            <button
                onClick={() => onDismiss(toast.id)}
                className="p-0.5 text-slate-600 hover:text-white transition-colors shrink-0 mt-0.5"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

const ToastContainer = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
};
