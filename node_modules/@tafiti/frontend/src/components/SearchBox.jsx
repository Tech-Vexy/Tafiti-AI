import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { Search, Loader2, SlidersHorizontal, X, ChevronDown } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

const MIN_CITATION_OPTIONS = [
    { label: 'Any', value: 0 },
    { label: '≥ 10', value: 10 },
    { label: '≥ 50', value: 50 },
    { label: '≥ 100', value: 100 },
    { label: '≥ 500', value: 500 },
    { label: '≥ 1 000', value: 1000 },
];

/**
 * SearchBox with advanced filter panel.
 * Expose .focus() via ref so parent can call it on Cmd+K.
 */
export const SearchBox = forwardRef(({ onSearch, isLoading }, ref) => {
    const inputRef = useRef(null);
    const [query, setQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filter state
    const [minYear, setMinYear] = useState('');
    const [maxYear, setMaxYear] = useState('');
    const [minCitations, setMinCitations] = useState(0);

    // Expose focus() to parent
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }));

    const activeFilterCount = [
        minYear && Number(minYear) > 1900,
        maxYear && Number(maxYear) <= CURRENT_YEAR,
        minCitations > 0,
    ].filter(Boolean).length;

    const buildFilters = () => {
        const f = {};
        if (minYear && Number(minYear) > 1900) f.min_year = Number(minYear);
        if (maxYear && Number(maxYear) <= CURRENT_YEAR) f.max_year = Number(maxYear);
        if (minCitations > 0) f.min_citations = minCitations;
        return Object.keys(f).length > 0 ? f : null;
    };

    const clearFilters = () => {
        setMinYear('');
        setMaxYear('');
        setMinCitations(0);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query, buildFilters());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full relative group animate-fade-in anim-delay-100">
            {/* ── Main search bar ── */}
            <div className={`
                relative flex items-center p-2 glass-card-heavy rounded-2xl transition-all duration-500
                ${isLoading ? 'ring-2 ring-indigo-500/20' : 'group-hover:border-indigo-500/30 group-focus-within:ring-2 group-focus-within:ring-indigo-500/20'}
                ${showFilters ? 'rounded-b-none border-b-transparent' : ''}
            `}>
                <div className="pl-4 pr-3 text-[var(--text-muted)]">
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    ) : (
                        <Search className="w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="What are you researching today?  (⌘K)"
                    className="flex-1 bg-transparent border-none outline-none text-lg py-3 pr-4 text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
                    disabled={isLoading}
                />

                <div className="flex items-center gap-2 pr-2">
                    {/* Filters toggle */}
                    <button
                        type="button"
                        onClick={() => setShowFilters(f => !f)}
                        className={`relative p-3 rounded-xl transition-all duration-300 border ${
                            showFilters || activeFilterCount > 0
                                ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 border-transparent'
                        }`}
                        title="Advanced filters"
                    >
                        <SlidersHorizontal className="w-5 h-5" />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className={`
                            px-6 py-3 rounded-xl font-bold transition-all duration-300
                            ${query.trim()
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95'
                                : 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed'}
                        `}
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* ── Filter panel ── */}
            {showFilters && (
                <div className="glass-card-heavy rounded-t-none rounded-b-2xl border-t border-white/5 px-6 py-5 space-y-5 animate-slide-up">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Advanced Filters
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                            >
                                <X className="w-3 h-3" /> Clear all
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {/* Year range */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                From Year
                            </label>
                            <input
                                type="number"
                                min={1900}
                                max={CURRENT_YEAR}
                                value={minYear}
                                onChange={e => setMinYear(e.target.value)}
                                placeholder={`e.g. 2015`}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                To Year
                            </label>
                            <input
                                type="number"
                                min={1900}
                                max={CURRENT_YEAR}
                                value={maxYear}
                                onChange={e => setMaxYear(e.target.value)}
                                placeholder={`e.g. ${CURRENT_YEAR}`}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                            />
                        </div>

                        {/* Min citations */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Min Citations
                            </label>
                            <div className="relative">
                                <select
                                    value={minCitations}
                                    onChange={e => setMinCitations(Number(e.target.value))}
                                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer pr-8"
                                >
                                    {MIN_CITATION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value} className="bg-[#0f1117]">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {minYear && <Chip label={`From ${minYear}`} onRemove={() => setMinYear('')} />}
                            {maxYear && <Chip label={`Until ${maxYear}`} onRemove={() => setMaxYear('')} />}
                            {minCitations > 0 && (
                                <Chip
                                    label={`≥ ${minCitations.toLocaleString()} citations`}
                                    onRemove={() => setMinCitations(0)}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Search glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-emerald-500/0 rounded-2xl blur-lg transition-all duration-500 group-focus-within:from-indigo-500/20 group-focus-within:via-indigo-500/10 group-focus-within:to-emerald-500/20 -z-10" />
        </form>
    );
});
SearchBox.displayName = 'SearchBox';

// Filter chip
const Chip = ({ label, onRemove }) => (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
        {label}
        <button type="button" onClick={onRemove} className="hover:text-white transition-colors">
            <X className="w-2.5 h-2.5" />
        </button>
    </span>
);
