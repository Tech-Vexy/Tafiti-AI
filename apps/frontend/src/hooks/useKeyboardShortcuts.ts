'use client';

/**
 * Global keyboard shortcuts hook in TypeScript.
 */
import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onSynthesize?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts({
  onFocusSearch,
  onEscape,
  onSynthesize,
  onShowShortcuts,
}: KeyboardShortcutHandlers = {}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

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
