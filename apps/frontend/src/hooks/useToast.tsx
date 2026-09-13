'use client';

/**
 * Lightweight toast notification system in TypeScript.
 */
import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => number;
  removeToast: (id: number) => void;
  clear: () => void;
  success: (msg: string, dur?: number) => number;
  error: (msg: string, dur?: number) => number;
  info: (msg: string, dur?: number) => number;
  warn: (msg: string, dur?: number) => number;
  warning: (msg: string, dur?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const add = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const api: ToastContextType = {
    toasts,
    addToast: add,
    removeToast: dismiss,
    clear: dismissAll,
    success: (msg, dur) => add(msg, 'success', dur),
    error: (msg, dur) => add(msg, 'error', dur ?? 6000),
    info: (msg, dur) => add(msg, 'info', dur),
    warn: (msg, dur) => add(msg, 'warn', dur),
    warning: (msg, dur) => add(msg, 'warn', dur),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

const STYLES: Record<
  ToastType,
  { bar: string; icon: React.ReactNode; border: string; text: string }
> = {
  success: {
    bar: 'bg-emerald-500',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
    border: 'border-emerald-500/20',
    text: 'text-emerald-100',
  },
  error: {
    bar: 'bg-red-500',
    icon: <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
    border: 'border-red-500/20',
    text: 'text-red-100',
  },
  info: {
    bar: 'bg-sky-500',
    icon: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />,
    border: 'border-sky-500/20',
    text: 'text-sky-100',
  },
  warn: {
    bar: 'bg-amber-500',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    border: 'border-amber-500/20',
    text: 'text-amber-100',
  },
};

const ToastItem = ({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) => {
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
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 ${s.bar} rounded-full`} />
      {s.icon}
      <p className={`text-sm font-medium leading-snug flex-1 ${s.text}`}>
        {toast.message}
      </p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-slate-600 hover:text-[var(--text-main)] transition-colors shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const ToastContainer = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
