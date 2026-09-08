'use client';

import React from 'react';
import { X, Command } from 'lucide-react';

const SHORTCUTS = [
    { category: 'Navigation', items: [
        { keys: ['⌘', 'K'], description: 'Open command palette' },
        { keys: ['⌘', '⇧', '['], description: 'Previous page' },
        { keys: ['⌘', '⇧', ']'], description: 'Next page' },
    ]},
    { category: 'Research', items: [
        { keys: ['⌘', '↵'], description: 'Synthesize selected papers' },
        { keys: ['/'], description: 'Focus search (when not typing)' },
        { keys: ['Esc'], description: 'Close modals / deselect' },
    ]},
    { category: 'General', items: [
        { keys: ['?'], description: 'Show this cheat sheet' },
        { keys: ['⌘', 'D'], description: 'Toggle dark/light theme' },
    ]},
];

export const KeyboardShortcuts = ({ isOpen, onClose }) => {
    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass-card-heavy border-white/10 shadow-2xl rounded-2xl p-6 max-w-md w-full animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                            <Command className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h2 className="text-lg font-black tracking-tight">Keyboard Shortcuts</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-6">
                    {SHORTCUTS.map(group => (
                        <div key={group.category}>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-3">{group.category}</h3>
                            <div className="space-y-2">
                                {group.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
                                        <span className="text-sm text-slate-400 font-medium">{item.description}</span>
                                        <div className="flex items-center gap-1">
                                            {item.keys.map((key, j) => (
                                                <React.Fragment key={j}>
                                                    <kbd className="min-w-[28px] h-7 flex items-center justify-center px-2 bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-slate-300">
                                                        {key}
                                                    </kbd>
                                                    {j < item.keys.length - 1 && (
                                                        <span className="text-[10px] text-slate-600">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcuts;
