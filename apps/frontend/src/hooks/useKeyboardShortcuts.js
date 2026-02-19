/**
 * Global keyboard shortcuts hook.
 *
 * Registered shortcuts:
 *   Cmd/Ctrl + K  — focus the main search input
 *   Escape        — closes any open modal (citation graph, filter panel, etc.)
 *   Cmd/Ctrl + ↵  — trigger synthesis (when handler provided)
 *   ?             — show shortcut cheatsheet toast
 */
import { useEffect } from 'react';

/**
 * @param {object} handlers
 * @param {() => void}  [handlers.onFocusSearch]   — called on Cmd/Ctrl+K
 * @param {() => void}  [handlers.onEscape]         — called on Escape
 * @param {() => void}  [handlers.onSynthesize]     — called on Cmd/Ctrl+Enter
 * @param {() => void}  [handlers.onShowShortcuts]  — called on ?
 */
export function useKeyboardShortcuts({
    onFocusSearch,
    onEscape,
    onSynthesize,
    onShowShortcuts,
} = {}) {
    useEffect(() => {
        const handler = (e) => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            const isEditing = tag === 'input' || tag === 'textarea' || tag === 'select'
                || document.activeElement?.isContentEditable;

            const mod = e.metaKey || e.ctrlKey;

            // Cmd/Ctrl + K → focus search
            if (mod && e.key === 'k') {
                e.preventDefault();
                onFocusSearch?.();
                return;
            }

            // Cmd/Ctrl + Enter → synthesize
            if (mod && e.key === 'Enter') {
                e.preventDefault();
                onSynthesize?.();
                return;
            }

            // Escape → close modals
            if (e.key === 'Escape' && !isEditing) {
                onEscape?.();
                return;
            }

            // ? → show shortcuts help (only when not typing)
            if (e.key === '?' && !isEditing) {
                onShowShortcuts?.();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onFocusSearch, onEscape, onSynthesize, onShowShortcuts]);
}
