// @ts-nocheck
import React from 'react';

const Skeleton = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
    const variants = {
        default: 'h-4 w-full',
        text: 'h-4 w-3/4',
        title: 'h-6 w-1/2',
        avatar: 'h-10 w-10 rounded-full',
        card: 'h-32 w-full',
        button: 'h-10 w-24',
        circle: 'rounded-full',
        square: 'rounded-none',
    };

    return (
        <div
            ref={ref}
            role="status"
            aria-label="Loading"
            aria-busy="true"
            className={`skeleton-shimmer rounded-lg ${variants[variant]} ${className}`}
            {...props}
        />
    );
});

Skeleton.displayName = 'Skeleton';

// ─── Generic card skeleton ────────────────────────────────────────────────────
export const SkeletonCard = () => (
    <div role="status" aria-label="Loading card" className="space-y-4 p-6 bg-[var(--bg-glass)] border border-[var(--border-glass)] rounded-2xl">
        <Skeleton variant="avatar" className="h-12 w-12" />
        <Skeleton variant="title" />
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-1/2" />
    </div>
);

// ─── Paper card skeleton (matches PaperCard layout) ──────────────────────────
export const SkeletonPaperCard = () => (
    <div role="status" aria-label="Loading paper" className="glass-card p-5 sm:p-8 space-y-5">
        {/* Top badges */}
        <div className="flex justify-between items-start">
            <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-8 rounded-full" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
        </div>

        {/* Title */}
        <Skeleton variant="title" className="h-5 w-4/5" />

        {/* Metadata row */}
        <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
        </div>

        {/* Abstract lines */}
        <div className="space-y-2">
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-3/4" />
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 flex justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
        </div>
    </div>
);

// ─── Chat message skeleton ──────────────────────────────────────────────────
export const SkeletonChatMessage = ({ isUser = false }) => (
    <div role="status" aria-label="Loading message" className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[70%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
            <div className={`p-5 rounded-3xl ${isUser
                ? 'bg-sky-600/30'
                : 'bg-[var(--bg-glass)] border border-[var(--border-glass)]'
            } space-y-2`}>
                <Skeleton className={`h-4 ${isUser ? 'w-48' : 'w-full'}`} />
                <Skeleton className={`h-4 ${isUser ? 'w-32' : 'w-5/6'}`} />
                {!isUser && <Skeleton className="h-4 w-2/3" />}
            </div>
            <Skeleton className="h-3 w-12" />
        </div>
    </div>
);

// ─── Library list item skeleton ──────────────────────────────────────────────
export const SkeletonLibraryItem = () => (
    <div role="status" aria-label="Loading library item" className="flex items-center gap-4 p-5 bg-[var(--bg-glass)] border border-[var(--border-glass)] rounded-2xl">
        <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton variant="title" className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex gap-2 shrink-0">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
    </div>
);

// ─── History item skeleton ──────────────────────────────────────────────────
export const SkeletonHistoryItem = () => (
    <div role="status" aria-label="Loading history" className="glass-card-heavy p-5 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <Skeleton variant="title" className="h-5 w-64" />
            </div>
            <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-4/5" />
        <div className="flex items-center gap-4 pt-4 border-t border-white/5">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
            </div>
        </div>
    </div>
);

// ─── Notes item skeleton ────────────────────────────────────────────────────
export const SkeletonNoteItem = () => (
    <div role="status" aria-label="Loading note" className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton className="h-3 w-24" />
    </div>
);

// ─── Discovery grid skeleton ────────────────────────────────────────────────
export const SkeletonDiscoveryGrid = ({ count = 4 }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" role="status" aria-label="Loading discoveries">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonPaperCard key={i} />
        ))}
    </div>
);

// ─── Profile skeleton ───────────────────────────────────────────────────────
export const SkeletonProfile = () => (
    <div role="status" aria-label="Loading profile" className="space-y-6">
        <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
            <div className="space-y-3">
                <Skeleton variant="title" className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="glass-card p-5 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton variant="title" className="h-8 w-16" />
                    <Skeleton className="h-3 w-full" />
                </div>
            ))}
        </div>
    </div>
);

// ─── Table skeleton ─────────────────────────────────────────────────────────
export const TableLoading = ({ rows = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 bg-[var(--bg-glass)] border border-[var(--border-glass)] rounded-2xl">
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
        ))}
    </div>
);

export { Skeleton };
export default Skeleton;
