// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import {
    Check, Plus, X, ArrowRight, Loader2,
    Cpu, Activity, Sprout, TrendingUp, Atom, Users, Scale, Globe
} from 'lucide-react';
import { RESEARCH_FIELDS, getFieldById } from './ResearchChatbot/researchFields';
import useUserStore from '@/store/useUserStore';
import useResearchStore from '@/store/useResearchStore';
import api from '@/app/api/client';

const ONBOARDING_STORAGE_KEY = 'tafiti_onboarding_completed';

const TOPIC_SUGGESTIONS_BY_FIELD: Record<string, string[]> = {
    all: ['Artificial Intelligence', 'Public Health', 'Climate Resilience', 'Sustainable Energy', 'Global Economics'],
    cs_ai: ['Large Language Models', 'Distributed Systems', 'Computer Vision', 'Reinforcement Learning', 'AI Safety & Ethics', 'Formal Verification'],
    medicine: ['Clinical Oncology', 'Genomics & CRISPR', 'Epidemiology', 'Neuroscience', 'Immunotherapy', 'Metabolic Health'],
    agri_climate: ['Soil Carbon Sequestration', 'Drought-Resistant Crops', 'Agrivoltaics', 'Precision Farming', 'Microplastic Degradation'],
    economics: ['Monetary Policy', 'CBDCs & FinTech', 'Market Microstructure', 'Behavioral Economics', 'Development Finance'],
    physics_engineering: ['Solid-State Batteries', 'Quantum Computing', 'Nuclear Fusion', 'Perovskite Solar Cells', 'Nanomaterials'],
    social_psychology: ['Cognitive Psychology', 'Algorithmic Wellbeing', 'Urban Gentrification', 'Network Polarization', 'Linguistic Drift'],
    law_policy: ['AI Governance & EU AI Act', 'IP & Copyright in AI', 'Antitrust & Platforms', 'Data Privacy (GDPR)', 'International Trade'],
};

export function renderDisciplineIcon(iconName: string, className: string = 'w-4 h-4') {
    switch (iconName) {
        case 'Cpu': return <Cpu className={className} />;
        case 'Activity': return <Activity className={className} />;
        case 'Sprout': return <Sprout className={className} />;
        case 'TrendingUp': return <TrendingUp className={className} />;
        case 'Atom': return <Atom className={className} />;
        case 'Users': return <Users className={className} />;
        case 'Scale': return <Scale className={className} />;
        case 'Globe':
        default:
            return <Globe className={className} />;
    }
}

interface OnboardingPersonalizationModalProps {
    forceOpen?: boolean;
    onClose?: () => void;
}

export default function OnboardingPersonalizationModal({
    forceOpen = false,
    onClose,
}: OnboardingPersonalizationModalProps) {
    const { userProfile, setUserProfile, fetchUserProfile, clerkUser } = useUserStore();
    const { setDomainScope } = useResearchStore();

    const [isOpen, setIsOpen] = useState(false);
    const [selectedField, setSelectedField] = useState<string>('cs_ai');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [customTopicInput, setCustomTopicInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine if onboarding modal should automatically appear
    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true);
            return;
        }

        if (typeof window === 'undefined') return;

        const hasCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
        // Auto show if user has not completed onboarding and hasn't set their career field yet
        if (!hasCompleted && userProfile && !userProfile.career_field) {
            setIsOpen(true);
        }
    }, [forceOpen, userProfile]);

    // Initialize state with current user profile if available
    useEffect(() => {
        if (userProfile?.career_field) {
            const matched = RESEARCH_FIELDS.find(
                (f) => f.id === userProfile.career_field || f.label === userProfile.career_field
            );
            if (matched) setSelectedField(matched.id);
        }
        if (userProfile?.expertise_areas && userProfile.expertise_areas.length > 0) {
            setSelectedTopics(userProfile.expertise_areas);
        }
    }, [userProfile]);

    // Listen for custom open event (e.g. triggered from settings/profile)
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-onboarding-personalization', handleOpen);
        return () => window.removeEventListener('open-onboarding-personalization', handleOpen);
    }, []);

    const handleFieldSelect = (fieldId: string) => {
        setSelectedField(fieldId);
        // Pre-populate topic recommendations for selected field
        const defaults = TOPIC_SUGGESTIONS_BY_FIELD[fieldId] || [];
        setSelectedTopics(defaults.slice(0, 3));
    };

    const toggleTopic = (topic: string) => {
        if (selectedTopics.includes(topic)) {
            setSelectedTopics(selectedTopics.filter((t) => t !== topic));
        } else {
            setSelectedTopics([...selectedTopics, topic]);
        }
    };

    const handleAddCustomTopic = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = customTopicInput.trim();
        if (trimmed && !selectedTopics.includes(trimmed)) {
            setSelectedTopics([...selectedTopics, trimmed]);
            setCustomTopicInput('');
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const fieldObj = getFieldById(selectedField);
            const careerFieldVal = fieldObj.id;

            // 1. Update backend user profile
            try {
                await api.put('/auth/me', {
                    career_field: careerFieldVal,
                    expertise_areas: selectedTopics,
                });
            } catch (err) {
                console.warn('[Onboarding] Backend sync failed, saving locally:', err);
            }

            // 2. Update Zustand store
            setUserProfile((prev: any) => ({
                ...prev,
                career_field: careerFieldVal,
                expertise_areas: selectedTopics,
            }));

            // 3. Set research store domain scope
            setDomainScope(careerFieldVal);

            // 4. Mark onboarding completed in localStorage
            localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');

            // 5. Refresh user profile
            if (fetchUserProfile) fetchUserProfile();

            setIsOpen(false);
            onClose?.();
        } catch (error) {
            console.error('[Onboarding] Failed to save personalization:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        // Default to all disciplines and mark complete
        setDomainScope('all');
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        setIsOpen(false);
        onClose?.();
    };

    if (!isOpen) return null;

    const availableTopics = TOPIC_SUGGESTIONS_BY_FIELD[selectedField] || TOPIC_SUGGESTIONS_BY_FIELD['all'];
    const currentFieldObj = getFieldById(selectedField);

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
            <div className="relative w-full max-w-2xl bg-[var(--bg-elevated)] border border-[var(--border-glass)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text-main)] animate-scale-up">
                {/* Header without sparkles or blue glow */}
                <div className="relative p-6 pb-4 border-b border-[var(--border-glass)] bg-[var(--bg-elevated)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--btn-surface)] text-[var(--text-dim)] border border-[var(--border-glass)] mb-1">
                                <span>Research Onboarding</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)]">
                                Personalize Your Research
                            </h2>
                            <p className="text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
                                Select your primary discipline and focus topics. Tafiti will tailor suggested prompts, literature retrieval, and deep synthesis specifically for your field.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--sidebar-hover)] transition-colors"
                            aria-label="Skip onboarding"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Step 1: Discipline Selection Grid */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                1. Primary Research Discipline
                            </label>
                            <span className="text-xs text-[var(--text-main)] font-semibold">
                                {currentFieldObj.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {RESEARCH_FIELDS.map((field) => {
                                const isSelected = selectedField === field.id;
                                return (
                                    <button
                                        key={field.id}
                                        type="button"
                                        onClick={() => handleFieldSelect(field.id)}
                                        className={`group relative flex items-start gap-3 p-3 rounded-xl text-left transition-all border ${
                                            isSelected
                                                ? 'bg-[var(--sidebar-hover)] border-[var(--text-main)] text-[var(--text-main)] shadow-sm ring-1 ring-[var(--text-main)]/20'
                                                : 'bg-[var(--btn-surface)] hover:bg-[var(--sidebar-hover)] border-[var(--border-glass)] text-[var(--text-dim)] hover:text-[var(--text-main)]'
                                        }`}
                                    >
                                        <div
                                            className={`p-2 rounded-lg shrink-0 mt-0.5 transition-colors ${
                                                isSelected
                                                    ? 'bg-[var(--text-main)] text-[var(--bg-main)] shadow-sm'
                                                    : 'bg-[var(--bg-elevated)] border border-[var(--border-glass)] text-[var(--text-main)] group-hover:border-[var(--border-focus)]'
                                            }`}
                                        >
                                            {renderDisciplineIcon(field.icon, 'w-4 h-4')}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="text-xs sm:text-sm font-semibold truncate text-[var(--text-main)]">
                                                {field.label}
                                            </div>
                                            <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed mt-0.5">
                                                {field.description}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[var(--text-main)] text-[var(--bg-main)] flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Research Topics / Focus Areas */}
                    <div className="space-y-3 pt-2 border-t border-[var(--border-glass)]">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            2. Key Areas of Interest & Topics (Optional)
                        </label>

                        {/* Suggested topic chips */}
                        <div className="flex flex-wrap gap-1.5">
                            {availableTopics.map((topic) => {
                                const isChecked = selectedTopics.includes(topic);
                                return (
                                    <button
                                        key={topic}
                                        type="button"
                                        onClick={() => toggleTopic(topic)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                            isChecked
                                                ? 'bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)] font-semibold shadow-sm'
                                                : 'bg-[var(--btn-surface)] text-[var(--text-dim)] hover:text-[var(--text-main)] border-[var(--border-glass)] hover:bg-[var(--sidebar-hover)]'
                                        }`}
                                    >
                                        {isChecked ? (
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        ) : (
                                            <Plus className="w-3 h-3 opacity-60" />
                                        )}
                                        <span>{topic}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Topic Input */}
                        <form onSubmit={handleAddCustomTopic} className="flex gap-2 pt-1">
                            <input
                                type="text"
                                value={customTopicInput}
                                onChange={(e) => setCustomTopicInput(e.target.value)}
                                placeholder="Add custom topic or keyword (e.g. Multimodal LLMs)..."
                                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[var(--btn-surface)] border border-[var(--border-glass)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={!customTopicInput.trim()}
                                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[var(--btn-surface)] hover:bg-[var(--sidebar-hover)] border border-[var(--border-glass)] text-[var(--text-main)] disabled:opacity-40 transition-colors shrink-0"
                            >
                                Add
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 border-t border-[var(--border-glass)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    >
                        Skip for now
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 active:scale-98 transition-all shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving preferences...</span>
                            </>
                        ) : (
                            <>
                                <span>Save & Start Researching</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
