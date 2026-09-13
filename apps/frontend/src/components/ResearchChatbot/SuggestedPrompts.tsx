'use client';

import React, { useState } from 'react';
import { ArrowUpRight, RotateCw, Compass } from 'lucide-react';

interface SuggestedPromptsProps {
    onSelectPrompt: (prompt: string) => void;
}

const ALL_PROMPT_SETS = [
    [
        "Where are the gaps in the literature on malaria vaccine efficacy in East Africa?",
        "What does research say about mobile money adoption and MSME growth in Kenya?",
        "How do researchers measure institutional trust in sub-Saharan governance studies?",
        "Synthesize climate adaptation strategies in dryland agriculture across the Sahel",
    ],
    [
        "Compare NLP benchmark performance on low-resource African languages (Swahili, Yoruba, Amharic)",
        "What are the verified economic outcomes of universal healthcare pilots in Rwanda?",
        "Identify contradictions in recent solar microgrid electrification evaluations",
        "How has debt distress impacted infrastructure financing in developing nations since 2020?",
    ],
    [
        "What are the emerging methodologies in maternal mortality reduction studies in Nigeria?",
        "Synthesize the impact of algorithmic trading on frontier African stock exchanges",
        "Where are the underexplored niches in indigenous knowledge systems and climate resilience?",
        "Evaluate empirical papers comparing teacher training interventions in primary education",
    ]
];

export default function SuggestedPrompts({ onSelectPrompt }: SuggestedPromptsProps) {
    const [setIndex, setSetIndex] = useState(0);

    const handleRotate = () => {
        setSetIndex((prev) => (prev + 1) % ALL_PROMPT_SETS.length);
    };

    const currentPrompts = ALL_PROMPT_SETS[setIndex];

    return (
        <div className="w-full max-w-3xl mx-auto space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
                    <Compass className="w-3.5 h-3.5" style={{ color: 'var(--primary-color)' }} />
                    <span>Try one of these</span>
                </div>
                <button
                    onClick={handleRotate}
                    title="Load more suggestions"
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors py-1 px-2 rounded-lg hover:bg-[var(--sidebar-hover)]"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                </button>
            </div>

            <div className="flex flex-col gap-2">
                {currentPrompts.map((prompt, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSelectPrompt(prompt)}
                        className="group flex items-center justify-between text-left p-3.5 sm:px-4 rounded-xl transition-all duration-200 hover:bg-[var(--sidebar-hover)]"
                        style={{ background: 'var(--pill-bg)', border: '1px solid var(--pill-border)' }}
                    >
                        <span className="text-xs sm:text-sm font-medium transition-colors leading-relaxed pr-4" style={{ color: 'var(--text-dim)' }}>
                            {prompt}
                        </span>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors" style={{ background: 'var(--btn-surface)' }}>
                            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--icon-dim)' }} />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
