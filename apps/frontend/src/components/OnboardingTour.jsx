'use client';

/**
 * Interactive onboarding tour for first-time Tafiti users.
 *
 * Steps:
 *   1. Welcome — splash intro
 *   2. Search — highlight the main search bar
 *   3. Sidebar — highlight navigation
 *   4. Library — highlight saved papers
 *   5. Research Chat — highlight chat
 *   6. Thesis — highlight thesis editor
 *   7. Command Palette — teach ⌘K
 *
 * Persistence: localStorage key `tafiti-tour-completed`.
 * Elements are targeted via `data-tour="step-id"` attributes.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Search, Compass, Bookmark, MessageSquare, PenLine,
    Command, Rocket, ArrowRight, ArrowLeft, X, Sparkles,
    GraduationCap, ChevronRight
} from 'lucide-react';

// ─── Tour Steps ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Tafiti AI',
        description: 'Your AI-powered research platform. Let us show you around — this tour takes about 60 seconds.',
        icon: Rocket,
        target: null, // center overlay, no element highlight
        placement: 'center',
        accent: 'from-indigo-500 to-emerald-400',
    },
    {
        id: 'search',
        title: 'Powerful Search',
        description: 'Search across millions of academic papers from OpenAlex, Semantic Scholar, CORE, and more. Use advanced filters by year and citation count.',
        icon: Search,
        target: '[data-tour="search-bar"]',
        placement: 'bottom',
        accent: 'from-indigo-500 to-blue-400',
    },
    {
        id: 'navigation',
        title: 'Quick Navigation',
        description: 'Your research toolkit is organized in the sidebar — from discovery to thesis writing. Press ⌘K anytime to open the command palette for instant access.',
        icon: Compass,
        target: '[data-tour="sidebar-nav"]',
        placement: 'right',
        accent: 'from-indigo-500 to-violet-400',
    },
    {
        id: 'synthesize',
        title: 'AI Synthesis',
        description: 'Select papers and hit Synthesize — Tafiti will analyze them together, find connections, contradictions, and generate a comprehensive research synthesis.',
        icon: Sparkles,
        target: '[data-tour="synthesize-area"]',
        placement: 'bottom',
        accent: 'from-indigo-500 to-amber-400',
    },
    {
        id: 'library',
        title: 'Your Library',
        description: 'Save papers with one click. Your library grows with your research — access saved papers anytime for quick reference and synthesis.',
        icon: Bookmark,
        target: '[data-tour="nav-library"]',
        placement: 'right',
        accent: 'from-emerald-500 to-teal-400',
    },
    {
        id: 'chat',
        title: 'Research Chat',
        description: 'Have a conversation with your research. Upload PDFs, select papers as context, and ask deep questions. The AI grounds its answers in your sources.',
        icon: MessageSquare,
        target: '[data-tour="nav-chat"]',
        placement: 'right',
        accent: 'from-blue-500 to-cyan-400',
    },
    {
        id: 'thesis',
        title: 'Thesis Editor',
        description: 'Write your thesis with AI assistance — auto-formatting, citation insertion, version history, and real-time collaboration with your research team.',
        icon: PenLine,
        target: '[data-tour="nav-thesis"]',
        placement: 'right',
        accent: 'from-violet-500 to-pink-400',
    },
    {
        id: 'command-palette',
        title: 'Command Palette',
        description: 'Press ⌘K to open the command palette — quickly jump to any page, trigger actions, or search your papers. It\'s the fastest way to navigate.',
        icon: Command,
        target: '[data-tour="cmd-k-hint"]',
        placement: 'bottom',
        accent: 'from-indigo-500 to-indigo-400',
    },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'tafiti-tour-completed';

function hasCompletedTour() {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

function markTourComplete() {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
}

function markTourIncomplete() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── Spotlight (cuts a hole in the overlay) ──────────────────────────────────
const Spotlight = ({ rect, isVisible }) => {
    if (!rect || !isVisible) return null;

    const padding = 12;
    const borderRadius = 16;

    return (
        <div
            className="fixed z-[10001] pointer-events-none transition-all duration-500 ease-out"
            style={{
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
                borderRadius,
                boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.3), inset 0 0 20px rgba(99, 102, 241, 0.1)`,
            }}
        />
    );
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip = ({ step, stepIndex, totalSteps, targetRect, onNext, onPrev, onSkip, onFinish }) => {
    const tooltipRef = useRef(null);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [arrowStyle, setArrowStyle] = useState({});
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setIsReady(false);
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, [stepIndex]);

    useEffect(() => {
        if (!tooltipRef.current || !isReady) return;

        const tooltip = tooltipRef.current;
        const tRect = tooltip.getBoundingClientRect();
        const placement = step.placement || 'bottom';
        const gap = 20;

        let top, left;
        let arrowTop, arrowLeft;

        if (!targetRect || placement === 'center') {
            // Center of screen
            top = (window.innerHeight - tRect.height) / 2;
            left = (window.innerWidth - tRect.width) / 2;
            arrowTop = null;
            arrowLeft = null;
        } else {
            switch (placement) {
                case 'bottom':
                    top = targetRect.bottom + gap;
                    left = targetRect.left + (targetRect.width - tRect.width) / 2;
                    arrowTop = -8;
                    arrowLeft = tRect.width / 2 - 8;
                    break;
                case 'top':
                    top = targetRect.top - tRect.height - gap;
                    left = targetRect.left + (targetRect.width - tRect.width) / 2;
                    arrowTop = tRect.height - 8;
                    arrowLeft = tRect.width / 2 - 8;
                    break;
                case 'right':
                    top = targetRect.top + (targetRect.height - tRect.height) / 2;
                    left = targetRect.right + gap;
                    arrowTop = tRect.height / 2 - 8;
                    arrowLeft = -8;
                    break;
                case 'left':
                    top = targetRect.top + (targetRect.height - tRect.height) / 2;
                    left = targetRect.left - tRect.width - gap;
                    arrowTop = tRect.height / 2 - 8;
                    arrowLeft = tRect.width - 8;
                    break;
                default:
                    top = targetRect.bottom + gap;
                    left = targetRect.left + (targetRect.width - tRect.width) / 2;
                    arrowTop = -8;
                    arrowLeft = tRect.width / 2 - 8;
            }

            // Keep tooltip on screen
            if (top < 10) top = 10;
            if (top + tRect.height > window.innerHeight - 10) top = window.innerHeight - tRect.height - 10;
            if (left < 10) left = 10;
            if (left + tRect.width > window.innerWidth - 10) left = window.innerWidth - tRect.width - 10;
        }

        setTooltipStyle({ top, left });
        if (arrowTop !== null) {
            setArrowStyle({ top: arrowTop, left: arrowLeft, placement });
        }
    }, [stepIndex, targetRect, isReady, step.placement]);

    const Icon = step.icon;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;

    return (
        <div
            ref={tooltipRef}
            className={`fixed z-[10002] w-[340px] max-w-[calc(100vw-2rem)] transition-all duration-500 ease-out ${
                isReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'
            }`}
            style={tooltipStyle}
            role="dialog"
            aria-modal="true"
            aria-label={`Tour step ${stepIndex + 1} of ${totalSteps}: ${step.title}`}
        >
            {/* Arrow */}
            {arrowStyle.placement && (
                <div
                    className="absolute w-4 h-4 bg-[#0d1117] border-white/10 rotate-45"
                    style={{
                        ...arrowStyle,
                        ...(arrowStyle.placement === 'bottom' ? { borderBottom: 'none', borderRight: 'none' } : {}),
                        ...(arrowStyle.placement === 'top' ? { borderTop: 'none', borderLeft: 'none' } : {}),
                        ...(arrowStyle.placement === 'right' ? { borderTop: 'none', borderRight: 'none' } : {}),
                        ...(arrowStyle.placement === 'left' ? { borderTop: 'none', borderLeft: 'none' } : {}),
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                />
            )}

            {/* Card */}
            <div className="bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                {/* Accent gradient top bar */}
                <div className={`h-1 bg-gradient-to-r ${step.accent}`} />

                <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.accent} bg-opacity-20 flex items-center justify-center`}
                                style={{ background: `linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.1))` }}>
                                <Icon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white tracking-tight">{step.title}</h3>
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                    Step {stepIndex + 1} of {totalSteps}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onSkip}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-all shrink-0"
                            title="Skip tour"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        {step.description}
                    </p>

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-2">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    i === stepIndex
                                        ? 'w-6 bg-indigo-500'
                                        : i < stepIndex
                                            ? 'w-1.5 bg-indigo-500/50'
                                            : 'w-1.5 bg-white/10'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-3">
                        {!isFirst ? (
                            <button
                                onClick={onPrev}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-white hover:bg-white/5 border border-white/5 transition-all"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back
                            </button>
                        ) : (
                            <button
                                onClick={onSkip}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-400 transition-all"
                            >
                                Skip tour
                            </button>
                        )}

                        {isLast ? (
                            <button
                                onClick={onFinish}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
                            >
                                <Sparkles className="w-4 h-4" />
                                Get Started
                            </button>
                        ) : (
                            <button
                                onClick={onNext}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
                            >
                                Next
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Welcome Splash (first step, no target) ──────────────────────────────────
const WelcomeSplash = ({ onNext, onSkip }) => {
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 animate-fade-in">
            <div className={`transition-all duration-700 ease-out ${isReady ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                <div className="glass-card-heavy border-white/10 shadow-2xl rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center space-y-8">
                    {/* Animated logo */}
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 rounded-3xl animate-pulse-glow" />
                        <div className="relative w-full h-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/10 rounded-3xl flex items-center justify-center border border-indigo-500/20">
                            <Rocket className="w-12 h-12 text-indigo-400" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-black tracking-tight">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-white">
                                Welcome to Tafiti
                            </span>
                        </h1>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                            Your AI-powered research intelligence platform. Search millions of papers, synthesize insights, and write your thesis — all in one place.
                        </p>
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {[
                            { icon: Search, label: 'Search', color: 'indigo' },
                            { icon: Sparkles, label: 'Synthesize', color: 'amber' },
                            { icon: Bookmark, label: 'Library', color: 'emerald' },
                            { icon: MessageSquare, label: 'Chat', color: 'blue' },
                            { icon: PenLine, label: 'Thesis', color: 'violet' },
                        ].map(f => (
                            <span key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-xs font-bold text-slate-400">
                                <f.icon className="w-3 h-3" />
                                {f.label}
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            onClick={onSkip}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Skip Tour
                        </button>
                        <button
                            onClick={onNext}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Take the Tour
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main OnboardingTour Component ───────────────────────────────────────────
export const OnboardingTour = ({ forceShow = false }) => {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const observerRef = useRef(null);

    // Check if tour should show
    useEffect(() => {
        if (forceShow) {
            setIsActive(true);
            return;
        }
        if (!hasCompletedTour()) {
            // Delay to let the page render
            const timer = setTimeout(() => setIsActive(true), 800);
            return () => clearTimeout(timer);
        }
    }, [forceShow]);

    // Measure target element on step change
    const measureTarget = useCallback(() => {
        const step = TOUR_STEPS[currentStep];
        if (!step?.target) {
            setTargetRect(null);
            return;
        }

        const el = document.querySelector(step.target);
        if (el) {
            // Scroll element into view
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            // Wait for scroll, then measure
            setTimeout(() => {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
            }, 350);
        } else {
            setTargetRect(null);
        }
    }, [currentStep]);

    useEffect(() => {
        if (!isActive) return;
        measureTarget();

        // Re-measure on resize
        const handleResize = () => measureTarget();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isActive, currentStep, measureTarget]);

    // MutationObserver to re-measure if DOM changes (e.g., sidebar collapse)
    useEffect(() => {
        if (!isActive) return;
        observerRef.current = new MutationObserver(() => {
            measureTarget();
        });
        observerRef.current.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style'],
        });
        return () => observerRef.current?.disconnect();
    }, [isActive, measureTarget]);

    const handleNext = useCallback(() => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setIsAnimating(true);
            setTargetRect(null);
            setTimeout(() => {
                setCurrentStep(prev => prev + 1);
                setIsAnimating(false);
            }, 200);
        }
    }, [currentStep]);

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            setIsAnimating(true);
            setTargetRect(null);
            setTimeout(() => {
                setCurrentStep(prev => prev - 1);
                setIsAnimating(false);
            }, 200);
        }
    }, [currentStep]);

    const handleFinish = useCallback(() => {
        setIsAnimating(true);
        setTargetRect(null);
        setTimeout(() => {
            markTourComplete();
            setIsActive(false);
            setCurrentStep(0);
            setIsAnimating(false);
        }, 300);
    }, []);

    const handleSkip = useCallback(() => {
        markTourComplete();
        setIsActive(false);
        setCurrentStep(0);
    }, []);

    // Allow restarting tour from outside
    useEffect(() => {
        window.__restartTour = () => {
            markTourIncomplete();
            setCurrentStep(0);
            setIsActive(true);
        };
        return () => { delete window.__restartTour; };
    }, []);

    if (!isActive) return null;

    const step = TOUR_STEPS[currentStep];
    const isFirstStep = step.id === 'welcome';

    return (
        <div className="pointer-events-auto">
            {/* Dark overlay (behind spotlight) */}
            <div
                className={`fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm transition-opacity duration-500 ${
                    isAnimating ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={handleSkip}
            />

            {/* Spotlight */}
            <Spotlight rect={targetRect} isVisible={!isAnimating && !isFirstStep} />

            {/* Welcome splash or Tooltip */}
            {isFirstStep ? (
                <WelcomeSplash onNext={handleNext} onSkip={handleSkip} />
            ) : (
                <Tooltip
                    step={step}
                    stepIndex={currentStep}
                    totalSteps={TOUR_STEPS.length}
                    targetRect={targetRect}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onSkip={handleSkip}
                    onFinish={handleFinish}
                />
            )}
        </div>
    );
};

// ─── Hook for external control ───────────────────────────────────────────────
export function useOnboardingTour() {
    return {
        restartTour: () => window.__restartTour?.(),
        hasCompleted: hasCompletedTour,
    };
}

export default OnboardingTour;
