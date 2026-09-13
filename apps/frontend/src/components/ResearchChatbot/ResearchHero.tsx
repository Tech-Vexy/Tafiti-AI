'use client';

import React from 'react';
interface ResearchHeroProps {
    onExploreRepo?: () => void;
}

export default function ResearchHero({ onExploreRepo }: ResearchHeroProps) {
    return (
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6 pt-4 sm:pt-8 animate-reveal">
            {/* Main Headline (inspired by scite.ai & exa.ai) */}
            <div className="space-y-3">
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[var(--text-main)] leading-[1.15]">
                    What are you researching
                </h1>
                <p className="text-sm sm:text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    Synthesize literature, fact-check claims, and uncover research gaps with verified academic citations and African repository intelligence.
                </p>
            </div>
        </div>
    );
}
