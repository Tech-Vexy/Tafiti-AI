import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingState = ({ 
    message = 'Loading...', 
    size = 'md',
    fullScreen = false,
    className = '' 
}) => {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16',
    };
    
    const content = (
        <div role="status" aria-live="polite" aria-label={message} className={`flex flex-col items-center justify-center gap-4 ${className}`}>
            <Loader2 aria-hidden="true" className={`animate-spin text-indigo-500 ${sizes[size]}`} />
            {message && (
                <p className="text-sm text-[var(--text-dim)]">{message}</p>
            )}
        </div>
    );
    
    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-[var(--bg-main)]/80 backdrop-blur-sm z-50 flex items-center justify-center">
                {content}
            </div>
        );
    }
    
    return content;
};

export const PageLoading = ({ message = 'Loading page...' }) => (
    <div className="min-h-[400px] flex items-center justify-center">
        <LoadingState message={message} size="lg" />
    </div>
);

export const TableLoading = ({ rows = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 bg-[var(--bg-glass)] border border-[var(--border-glass)] rounded-2xl">
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-lg animate-pulse w-3/4" />
                    <div className="h-3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-lg animate-pulse w-1/2" />
                </div>
                <div className="w-24 h-8 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-lg animate-pulse" />
            </div>
        ))}
    </div>
);

export default LoadingState;
