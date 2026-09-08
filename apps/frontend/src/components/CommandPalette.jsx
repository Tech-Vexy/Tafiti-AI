'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Search, MessageSquare, Compass, Bookmark, FileText, History,
    FlaskConical, CreditCard,
    Settings, HelpCircle, Rocket, Sparkles, PenLine, Brain, Command, X,
    CornerDownLeft, Lightbulb
} from 'lucide-react';

// ─── Navigation items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { id: 'feed', label: 'Home', icon: Rocket, group: 'Navigation', keywords: ['home', 'dashboard', 'feed'] },
    { id: 'chat', label: 'Research Chat', icon: MessageSquare, group: 'Navigation', keywords: ['chat', 'ask', 'question'] },
    { id: 'discover', label: 'Discover', icon: Compass, group: 'Navigation', keywords: ['discover', 'explore', 'find'] },
    { id: 'library', label: 'My Library', icon: Bookmark, group: 'Navigation', keywords: ['library', 'saved', 'bookmarks'] },
    { id: 'gap-analysis', label: 'Gap Analysis', icon: FlaskConical, group: 'Navigation', keywords: ['gap', 'analysis', 'missing'] },
    { id: 'workspace', label: 'Workspace', icon: Brain, group: 'Navigation', keywords: ['workspace', 'teams', 'agents'] },
    { id: 'thesis', label: 'Thesis Editor', icon: PenLine, group: 'Navigation', keywords: ['thesis', 'editor', 'write', 'document'] },
    { id: 'research-review', label: 'Research Review', icon: Lightbulb, group: 'Research', keywords: ['timeline', 'field', 'prisma', 'pico', 'systematic', 'review', 'screening'] },
    { id: 'notes', label: 'Notes', icon: FileText, group: 'Navigation', keywords: ['notes', 'clips', 'highlights'] },
    { id: 'history', label: 'History', icon: History, group: 'Navigation', keywords: ['history', 'past', 'recent'] },
    { id: 'billing', label: 'Billing & Plans', icon: CreditCard, group: 'Account', keywords: ['billing', 'plan', 'subscription', 'upgrade'] },
    { id: 'profile', label: 'Settings', icon: Settings, group: 'Account', keywords: ['settings', 'profile', 'account'] },
    { id: 'support', label: 'Support', icon: HelpCircle, group: 'Account', keywords: ['support', 'help', 'contact'] },
];

// ─── Quick actions ───────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    { id: 'new-search', label: 'New Search', icon: Search, action: 'search', keywords: ['search', 'find', 'query'] },
    { id: 'synthesize', label: 'Synthesize Selected Papers', icon: Sparkles, action: 'synthesize', keywords: ['synthesis', 'summarize', 'analyze'] },
    { id: 'upload-pdf', label: 'Upload PDF', icon: FileText, action: 'upload', keywords: ['upload', 'pdf', 'import'] },
    { id: 'toggle-theme', label: 'Toggle Theme', icon: Command, action: 'theme', keywords: ['theme', 'dark', 'light', 'mode'] },
];

// ─── Fuzzy match ─────────────────────────────────────────────────────────────
function fuzzyMatch(query, text) {
    if (!query) return true;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    // Exact substring match first
    if (t.includes(q)) return { score: 100, indices: [] };
    // Word boundary match
    const words = q.split(/\s+/);
    const allWordsMatch = words.every(w => t.includes(w));
    if (allWordsMatch) return { score: 80, indices: [] };
    // Fuzzy char-by-char
    let qi = 0, ti = 0, score = 0, consecutive = 0;
    while (qi < q.length && ti < t.length) {
        if (q[qi] === t[ti]) {
            score += consecutive > 0 ? 5 : 1;
            consecutive++;
            qi++;
        } else {
            consecutive = 0;
        }
        ti++;
    }
    return qi === q.length ? { score, indices: [] } : null;
}

function scoreItem(query, item) {
    const label = item.label || '';
    const keywords = (item.keywords || []).join(' ');
    const group = item.group || '';
    
    const labelMatch = fuzzyMatch(query, label);
    const keywordMatch = fuzzyMatch(query, keywords);
    const groupMatch = fuzzyMatch(query, group);
    
    let best = null;
    if (labelMatch) best = { ...labelMatch, score: labelMatch.score + 50 };
    if (keywordMatch && (!best || keywordMatch.score > best.score - 50)) {
        best = { score: (best?.score || 0) + keywordMatch.score, ...keywordMatch };
    }
    if (groupMatch) {
        best = { score: (best?.score || 0) + groupMatch.score * 0.5, ...groupMatch };
    }
    return best;
}

// ─── Command Palette Component ───────────────────────────────────────────────
export const CommandPalette = ({ isOpen, onClose, onNavigate, papers = [], onSearch }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeCategory, setActiveCategory] = useState('all');
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Build combined results
    const results = useMemo(() => {
        const items = [];
        
        if (!query.trim()) {
            // Show navigation items grouped
            const groups = {};
            NAV_ITEMS.forEach(item => {
                const g = item.group || 'Navigation';
                if (!groups[g]) groups[g] = [];
                groups[g].push({ ...item, type: 'nav' });
            });
            Object.entries(groups).forEach(([group, groupItems]) => {
                items.push({ type: 'header', label: group, id: `header-${group}` });
                groupItems.forEach(item => items.push(item));
            });
            
            // Quick actions
            items.push({ type: 'header', label: 'Quick Actions', id: 'header-actions' });
            QUICK_ACTIONS.forEach(action => items.push({ ...action, type: 'action' }));
        } else {
            // Search across everything
            const navResults = NAV_ITEMS
                .map(item => ({ ...item, type: 'nav', match: scoreItem(query, item) }))
                .filter(item => item.match)
                .sort((a, b) => b.match.score - a.match.score);
            
            const actionResults = QUICK_ACTIONS
                .map(action => ({ ...action, type: 'action', match: scoreItem(query, action) }))
                .filter(action => action.match)
                .sort((a, b) => b.match.score - a.match.score);
            
            // Search papers
            const paperResults = papers
                .map(paper => ({
                    ...paper,
                    type: 'paper',
                    label: paper.title || 'Untitled',
                    icon: FileText,
                    match: scoreItem(query, { label: paper.title, keywords: (paper.authors || []).join(' ') }),
                }))
                .filter(paper => paper.match)
                .sort((a, b) => b.match.score - a.match.score)
                .slice(0, 5);
            
            if (navResults.length) {
                items.push({ type: 'header', label: 'Navigation', id: 'header-nav' });
                items.push(...navResults);
            }
            if (actionResults.length) {
                items.push({ type: 'header', label: 'Actions', id: 'header-actions' });
                items.push(...actionResults);
            }
            if (paperResults.length) {
                items.push({ type: 'header', label: 'Papers', id: 'header-papers' });
                items.push(...paperResults);
            }
        }
        
        return items;
    }, [query, papers]);

    // Filter to only selectable items
    const selectableItems = useMemo(() => results.filter(r => r.type !== 'header'), [results]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setActiveCategory('all');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Keep selected item in view
    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = useCallback((item) => {
        if (item.type === 'nav') {
            onNavigate(item.id);
            onClose();
        } else if (item.type === 'action') {
            if (item.action === 'search') {
                onNavigate('feed');
                onClose();
                // Focus search after navigation
                setTimeout(() => {
                    document.querySelector('#tafiti-search')?.focus();
                }, 100);
            } else if (item.action === 'theme') {
                const current = localStorage.getItem('tafiti-theme') || 'dark';
                const next = current === 'dark' ? 'light' : 'dark';
                localStorage.setItem('tafiti-theme', next);
                document.documentElement.classList.toggle('light', next === 'light');
                onClose();
            } else {
                onNavigate(item.id);
                onClose();
            }
        } else if (item.type === 'paper') {
            // Could open paper detail or navigate to library
            onNavigate('library');
            onClose();
        }
    }, [onNavigate, onClose]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectableItems[selectedIndex]) {
                handleSelect(selectableItems[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [selectableItems, selectedIndex, handleSelect, onClose]);

    if (!isOpen) return null;

    let selectableIndex = -1;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-xl mx-4 glass-card-heavy border-white/10 shadow-2xl overflow-hidden animate-scale-in">
                {/* Search input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <Search className="w-5 h-5 text-slate-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Search navigation, actions, papers..."
                        className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm font-medium"
                        aria-label="Search commands"
                    />
                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-500 bg-white/5 border border-white/10 rounded-lg">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2 custom-scrollbar">
                    {results.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <p className="text-sm text-slate-500">No results found for &ldquo;{query}&rdquo;</p>
                        </div>
                    ) : (
                        results.map((item) => {
                            if (item.type === 'header') {
                                return (
                                    <div key={item.id} className="px-5 pt-4 pb-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                            {item.label}
                                        </span>
                                    </div>
                                );
                            }

                            selectableIndex++;
                            const idx = selectableIndex;
                            const isSelected = idx === selectedIndex;
                            const Icon = item.icon || Search;

                            return (
                                <button
                                    key={item.id || idx}
                                    data-index={idx}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                                        isSelected
                                            ? 'bg-indigo-500/10 text-white'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.label}</p>
                                        {item.type === 'paper' && item.authors && (
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {item.authors.slice(0, 2).join(', ')} · {item.year}
                                            </p>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 shrink-0">
                                            <CornerDownLeft className="w-3 h-3" />
                                            <span>Go</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600 font-bold">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↵</kbd>
                            Select
                        </span>
                    </div>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">⌘K</kbd>
                        Toggle
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
