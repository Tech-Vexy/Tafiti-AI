'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, Bell } from 'lucide-react';
import { ThoughtStep, PipelineStepTrace } from './ConversationThread';
import useResearchStore from '@/store/useResearchStore';
import { sanitizeStepLabel } from '@/lib/citationUtils';

interface LiveResearchTrackerProps {
    thoughtSteps?: ThoughtStep[];
    pipelineSteps?: PipelineStepTrace[];
    isLoading: boolean;
    isDeepMode?: boolean;
    query?: string;
}

export default function LiveResearchTracker({
    thoughtSteps = [],
    pipelineSteps = [],
    isLoading,
    isDeepMode = true,
    query = '',
}: LiveResearchTrackerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { notifyOnComplete, setNotifyOnComplete } = useResearchStore();
    const [permissionStatus, setPermissionStatus] = useState<string>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermissionStatus(Notification.permission);
        } else {
            setPermissionStatus('unsupported');
        }
    }, []);

    const handleToggleNotify = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            alert('Web notifications are not supported in your browser.');
            return;
        }

        if (Notification.permission === 'granted') {
            setNotifyOnComplete(!notifyOnComplete);
            return;
        }

        if (Notification.permission !== 'denied') {
            const result = await Notification.requestPermission();
            setPermissionStatus(result);
            if (result === 'granted') {
                setNotifyOnComplete(true);
                try {
                    new Notification('Notifications Enabled', {
                        body: 'Tafiti AI will alert you when your research synthesis completes.',
                        icon: '/favicon.ico',
                    });
                } catch {
                    // Ignore notification constructor errors
                }
            }
        } else {
            alert('Notification access is currently blocked in your browser settings. Please grant notification permission for this site.');
        }
    };

    if (!isLoading) return null;

    // Determine current live progress text from active steps or thoughts
    const runningStep = pipelineSteps.find((s) => s.status === 'running')?.label;
    const latestThought = thoughtSteps.length > 0 ? thoughtSteps[thoughtSteps.length - 1] : null;

    let activeStatus = 'Searching literature...';
    if (runningStep) {
        activeStatus = sanitizeStepLabel(runningStep);
    } else if (latestThought?.signature) {
        activeStatus = sanitizeStepLabel(latestThought.signature);
    } else if (isDeepMode) {
        activeStatus = 'Deep Research in progress...';
    }

    // Combine completed steps for the collapsible view
    const completedSteps = pipelineSteps.filter((s) => s.status === 'completed');
    const totalStepCount = completedSteps.length + (latestThought ? 1 : 0);
    const isNotified = notifyOnComplete && permissionStatus === 'granted';

    return (
        <div className="py-2.5 select-none animate-fade-in font-sans">
            {/* Minimalist, completely unboxed live status bar matching Perplexity */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Left: Pulsing status + steps badge */}
                <div className="inline-flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                    </span>

                    <span className="text-slate-300 font-medium tracking-tight">
                        {activeStatus}
                    </span>

                    {totalStepCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700/50 transition-colors cursor-pointer"
                            aria-label={isExpanded ? 'Collapse research steps' : `Researched ${totalStepCount} steps`}
                        >
                            <span>Researched {totalStepCount} step{totalStepCount > 1 ? 's' : ''}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}
                </div>

                {/* Right: Unboxed Notify Me button with browser notification access */}
                <div className="inline-flex items-center gap-2.5">
                    <span className="text-slate-500 text-[11px] hidden sm:inline">
                        Research continues in background
                    </span>

                    <button
                        type="button"
                        onClick={handleToggleNotify}
                        title={isNotified ? 'Notifications enabled' : 'Get notified when research completes'}
                        aria-label={isNotified ? 'Notifications enabled' : 'Notify me when research completes'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            isNotified
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/40'
                        }`}
                    >
                        <Bell className={`w-3.5 h-3.5 ${isNotified ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                        <span>{isNotified ? 'Notified' : 'Notify me'}</span>
                    </button>
                </div>
            </div>

            {/* Unboxed inline list of completed steps when expanded */}
            {isExpanded && (
                <div className="mt-2.5 pl-3 border-l-2 border-slate-800/80 space-y-1.5 text-xs text-slate-400 animate-fade-in">
                    {completedSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{sanitizeStepLabel(step.label)}</span>
                            {step.details && (
                                <span className="text-slate-500 text-[11px]">· {sanitizeStepLabel(step.details)}</span>
                            )}
                        </div>
                    ))}
                    {latestThought?.content && (
                        <div className="flex items-start gap-2 text-slate-400 pt-0.5">
                            <span className="text-sky-400 text-[11px] mt-0.5">→</span>
                            <span className="leading-relaxed line-clamp-2">{latestThought.content}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
