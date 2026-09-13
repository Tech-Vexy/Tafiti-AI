'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { ResearchPaper } from './SourceCardsCarousel';
import { extractDomain, getFaviconUrl } from '@/lib/citationUtils';

export type CitationSemanticType = 'supported' | 'contrasting' | 'mentioning';

export interface ServerCitationClassification {
    semantic_type?: CitationSemanticType;
    confidence?: number;
    quote?: string;
    source_title?: string;
}

export interface CitationBadgeProps {
    index?: number;
    source?: ResearchPaper;
    url?: string;
    domain?: string;
    title?: string;
    snippet?: string;
    type?: CitationSemanticType;
    classification?: ServerCitationClassification;
    onSelectSource?: (source: ResearchPaper) => void;
}

interface DomainTrustMetadata {
    status: string;
    description: string;
    learnMoreUrl: string;
}

/**
 * Domain credibility and trust metadata matching academic publication standards
 */
function getDomainTrustInfo(domain: string, targetUrl: string): DomainTrustMetadata {
    const d = (domain || '').toLowerCase().replace(/^www\./, '');
    
    if (d.includes('arxiv')) {
        return {
            status: 'Trusted',
            description: 'arxiv.org is trusted for hosting moderated preprints in physics, mathematics, computer science, and related fields, though individual manuscripts are not peer reviewed.',
            learnMoreUrl: 'https://arxiv.org/about',
        };
    }
    if (d.includes('biorxiv') || d.includes('medrxiv')) {
        return {
            status: 'Preprint Server',
            description: `${d} is a dedicated preprint repository for the biological and health sciences, hosted by Cold Spring Harbor Laboratory. Preprints are screened for offensive or dangerous content but are not peer reviewed.`,
            learnMoreUrl: `https://${d}/about`,
        };
    }
    if (
        d.includes('nature.com') ||
        d.includes('springer') ||
        d.includes('sciencedirect') ||
        d.includes('cell.com') ||
        d.includes('thelancet') ||
        d.includes('pnas.org')
    ) {
        return {
            status: 'Peer-Reviewed Journal',
            description: `${d} is a premier international academic publisher with world-renowned peer review and editorial standards.`,
            learnMoreUrl: targetUrl.startsWith('http') ? targetUrl : `https://${d}`,
        };
    }
    if (
        d.includes('neurips') ||
        d.includes('icml') ||
        d.includes('openreview') ||
        d.includes('acm.org') ||
        d.includes('ieee.org')
    ) {
        return {
            status: 'Peer-Reviewed Conference',
            description: `${d} publishes competitive, peer-reviewed conference proceedings and transactions in computer science, machine learning, and electrical engineering.`,
            learnMoreUrl: targetUrl.startsWith('http') ? targetUrl : `https://${d}`,
        };
    }
    if (d.includes('ncbi.nlm.nih.gov') || d.includes('pubmed')) {
        return {
            status: 'Government Archive',
            description: 'PubMed / NCBI is maintained by the U.S. National Institutes of Health, indexing authoritative biomedical and life sciences research.',
            learnMoreUrl: 'https://pubmed.ncbi.nlm.nih.gov/about/',
        };
    }

    return {
        status: 'Academic Source',
        description: `${d} is recognized as an authoritative academic or institutional repository indexed in scholarly literature databases.`,
        learnMoreUrl: targetUrl.startsWith('http') ? targetUrl : `https://${d}`,
    };
}

export default function CitationBadge({
    index,
    source,
    url,
    domain,
    title,
    snippet: customSnippet,
    onSelectSource,
}: CitationBadgeProps) {
    const [showPopover, setShowPopover] = useState(false);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [popoverCoords, setPopoverCoords] = useState<{
        top?: number;
        bottom?: number;
        left: number;
        width: number;
        placement: 'top' | 'bottom';
        arrowLeft: number;
    } | null>(null);

    const badgeRef = useRef<HTMLAnchorElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Resolve URL
    const rawUrl =
        url ||
        source?.pdf_url ||
        source?.url ||
        (source as any)?.link ||
        (source?.doi ? `https://doi.org/${source.doi}` : null);
    const targetUrl = rawUrl || '#';

    // Resolve domain label
    let resolvedDomain = domain;
    if (!resolvedDomain && rawUrl) {
        resolvedDomain = extractDomain(rawUrl, source);
    }
    if (!resolvedDomain && source) {
        resolvedDomain = source.source || source.journal || 'academic';
    }
    resolvedDomain = (resolvedDomain || 'source').toLowerCase().replace(/^www\./, '').replace(/\.[^.]+$/, (ext) => {
        if (ext === '.org' || ext === '.com' || ext === '.edu' || ext === '.net' || ext === '.io') return '';
        return ext;
    });

    const faviconUrl = getFaviconUrl(rawUrl, resolvedDomain);
    const trustInfo = getDomainTrustInfo(resolvedDomain, targetUrl);

    // Resolve paper title
    const paperTitle =
        source?.title ||
        title ||
        `${resolvedDomain.charAt(0).toUpperCase() + resolvedDomain.slice(1)} Academic Reference`;

    // Resolve snippet/abstract
    const snippet =
        customSnippet ||
        source?.abstract ||
        source?.excerpt ||
        (source as any)?.snippet ||
        (source as any)?.summary ||
        (source as any)?.description ||
        `Investigates empirical findings and computational frameworks published in ${paperTitle}.`;

    /**
     * Dynamically compute adaptive viewport placement:
     * - Flips to bottom if near top edge of window
     * - Flips to top if near bottom edge of window
     * - Clamps left to stay fully on-screen regardless of screen width
     * - Centers popover relative to badge
     */
    const updatePopoverPosition = useCallback(() => {
        if (!badgeRef.current) return;
        const rect = badgeRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // If badge scrolled off-screen, close popover
        if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
            setShowPopover(false);
            return;
        }

        const popoverWidth = Math.min(340, vw - 24);
        const badgeCenterX = rect.left + rect.width / 2;
        const idealLeft = badgeCenterX - popoverWidth / 2;
        const clampedLeft = Math.max(12, Math.min(idealLeft, vw - popoverWidth - 12));
        const arrowLeft = Math.max(16, Math.min(badgeCenterX - clampedLeft, popoverWidth - 16));

        // Determine vertical placement: top vs bottom
        // Estimated popover height ~ 240px
        const estimatedHeight = 240;
        const spaceAbove = rect.top;
        const spaceBelow = vh - rect.bottom;

        let placement: 'top' | 'bottom' = 'top';
        let top: number | undefined = undefined;
        let bottom: number | undefined = undefined;

        if (spaceAbove < estimatedHeight + 16 && spaceBelow >= estimatedHeight) {
            // Flip to bottom
            placement = 'bottom';
            top = rect.bottom + 8;
        } else if (spaceAbove >= estimatedHeight + 16) {
            // Stay on top
            placement = 'top';
            bottom = vh - rect.top + 8;
        } else {
            // Pick whichever side has more available space
            if (spaceBelow > spaceAbove) {
                placement = 'bottom';
                top = rect.bottom + 8;
            } else {
                placement = 'top';
                bottom = vh - rect.top + 8;
            }
        }

        setPopoverCoords({
            top,
            bottom,
            left: clampedLeft,
            width: popoverWidth,
            placement,
            arrowLeft,
        });
    }, []);

    useEffect(() => {
        if (!showPopover) return;
        updatePopoverPosition();

        const handleScrollOrResize = () => {
            updatePopoverPosition();
        };

        window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
        window.addEventListener('resize', handleScrollOrResize, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [showPopover, updatePopoverPosition]);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        updatePopoverPosition();
        setShowPopover(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowPopover(false);
        }, 220);
    };

    const handleClickBadge = (e: React.MouseEvent) => {
        // Highlight corresponding source card in sidebar if present
        if (index) {
            const el = document.getElementById(`source-card-${index}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                el.classList.add('ring-2', 'ring-sky-400', 'bg-sky-950/60');
                setTimeout(() => el.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-950/60'), 2200);
            }
        }
        if (source && onSelectSource) {
            onSelectSource(source);
        }
    };

    return (
        <span
            className="inline-block align-baseline mx-0.5 select-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Inline Perplexity-Style Citation Badge */}
            <a
                ref={badgeRef}
                href={targetUrl !== '#' ? targetUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClickBadge}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-normal bg-[#242426] hover:bg-[#2C2C2E] border border-white/[0.08] hover:border-white/[0.18] text-[#C7C7CC] hover:text-white transition-all cursor-pointer no-underline align-baseline group shadow-xs"
                title={`Citation: ${paperTitle}`}
            >
                <ShieldCheck className="w-3 h-3 text-[#8E8E93] group-hover:text-white transition-colors shrink-0" />
                <span className="tracking-tight">{resolvedDomain}</span>
            </a>

            {/* Adaptive Hover Popover Card Rendered via React Portal */}
            {showPopover && mounted && popoverCoords && createPortal(
                <div
                    ref={popoverRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        left: `${popoverCoords.left}px`,
                        top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
                        bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
                        width: `${popoverCoords.width}px`,
                        zIndex: 99999,
                    }}
                    className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/[0.12] shadow-2xl shadow-black/90 text-left space-y-2.5 pointer-events-auto backdrop-blur-xl animate-fade-in font-sans select-text"
                >
                    {/* Header Row: Domain Favicon + Domain Name */}
                    <div className="flex items-center gap-2 text-[#8E8E93] text-xs">
                        <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-white/10">
                            {!faviconFailed ? (
                                <img
                                    src={faviconUrl}
                                    alt={resolvedDomain}
                                    className="w-4 h-4 object-contain"
                                    onError={() => setFaviconFailed(true)}
                                />
                            ) : (
                                <span className="text-[9px] font-bold text-slate-300 uppercase">
                                    {resolvedDomain.charAt(0)}
                                </span>
                            )}
                        </div>
                        <span className="text-[13px] text-[#8E8E93] font-normal lowercase tracking-tight">
                            {resolvedDomain}
                        </span>
                    </div>

                    {/* Paper Title (Real Clickable Link) */}
                    <a
                        href={targetUrl !== '#' ? targetUrl : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[14px] font-semibold text-[#F2F2F7] hover:text-sky-300 transition-colors line-clamp-2 leading-snug cursor-pointer group/title"
                    >
                        {paperTitle}
                        <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-0 group-hover/title:opacity-100 transition-opacity text-sky-400 align-baseline" />
                    </a>

                    {/* Excerpt / Abstract */}
                    <p className="text-[12.5px] text-[#AEAEB2] leading-relaxed line-clamp-3">
                        {snippet}
                    </p>

                    {/* Domain Trust Section */}
                    <div className="border-t border-white/[0.08] pt-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#E5E5E7]">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                            <span>{trustInfo.status}</span>
                        </div>
                        <p className="text-[11.5px] text-[#8E8E93] leading-relaxed">
                            {trustInfo.description}
                        </p>
                        <div>
                            <a
                                href={trustInfo.learnMoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:text-sky-300 text-xs font-medium inline-block hover:underline"
                            >
                                Learn more
                            </a>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </span>
    );
}
