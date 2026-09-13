// @ts-nocheck
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { CitationPill } from './CitationPill';

/**
 * Parse citation string "[1, 2]" or "[3-5]" into array of integers [1, 2] or [3, 4, 5]
 */
function parseIndices(str) {
    const clean = str.replace(/[\[\]]/g, '').trim();
    const parts = clean.split(/[,\s]+/).filter(Boolean);
    const indices = [];

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end) && start <= end && end - start < 20) {
                for (let i = start; i <= end; i++) {
                    indices.push(i);
                }
                continue;
            }
        }
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
            indices.push(num);
        }
    }

    return [...new Set(indices)];
}

/**
 * Render text node, transforming [1], [1, 2], [1-3] into CitationPill
 */
function renderWithCitations(text, sources, onSelectSource) {
    if (typeof text !== 'string') return text;

    const CITATION_REGEX = /(\[\d+(?:[,\s-]+\d+)*\])/g;
    const parts = text.split(CITATION_REGEX);

    if (parts.length === 1) return text;

    return parts.map((part, idx) => {
        if (part.startsWith('[') && part.endsWith(']')) {
            const indices = parseIndices(part);
            if (indices.length > 0) {
                return (
                    <CitationPill
                        key={idx}
                        indices={indices}
                        sources={sources}
                        onSelectSource={onSelectSource}
                    />
                );
            }
        }
        return part;
    });
}

/**
 * Process children recursively to replace citation patterns in text
 */
function processChildren(children, sources, onSelectSource) {
    return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
            return renderWithCitations(child, sources, onSelectSource);
        }
        if (React.isValidElement(child) && child.props && child.props.children) {
            return React.cloneElement(child, {
                children: processChildren(child.props.children, sources, onSelectSource)
            });
        }
        return child;
    });
}

/**
 * CitationsMarkdownRenderer — ReactMarkdown wrapper that injects Perplexity-style
 * in-text CitationPills for any citations found in synthesis responses.
 */
export const CitationsMarkdownRenderer = ({ content, sources = [], onSelectSource, className = '' }) => {
    return (
        <div className={`prose prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    p: ({ children }) => (
                        <p className="mb-4 leading-relaxed text-[var(--text-dim)]">
                            {processChildren(children, sources, onSelectSource)}
                        </p>
                    ),
                    li: ({ children }) => (
                        <li className="mb-1 leading-relaxed text-[var(--text-dim)]">
                            {processChildren(children, sources, onSelectSource)}
                        </li>
                    ),
                    strong: ({ children }) => (
                        <strong className="text-sky-300 font-bold">
                            {processChildren(children, sources, onSelectSource)}
                        </strong>
                    ),
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-black text-white mt-6 mb-3 tracking-tight">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-xl font-bold text-white mt-5 mb-2.5 tracking-tight">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-bold text-white mt-4 mb-2 tracking-tight">
                            {children}
                        </h3>
                    ),
                    table: ({ children }) => (
                        <div className="w-full max-w-full my-6 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] shadow-sm overflow-hidden">
                            <div className="w-full overflow-x-auto scrollbar-thin overscroll-x-contain">
                                <table className="w-full min-w-[500px] sm:min-w-full text-left text-xs sm:text-sm border-collapse">
                                    {children}
                                </table>
                            </div>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-[var(--btn-surface)] text-[var(--text-main)] border-b border-[var(--border-glass)] text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
                            {children}
                        </thead>
                    ),
                    th: ({ children }) => (
                        <th className="py-2.5 px-3 sm:py-3 sm:px-4 font-semibold text-[var(--text-main)] border-b border-[var(--border-glass)] whitespace-nowrap text-xs sm:text-sm">
                            {children}
                        </th>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-[var(--border-glass)]/60">
                            {children}
                        </tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-[var(--sidebar-hover)] transition-colors">
                            {children}
                        </tr>
                    ),
                    td: ({ children }) => (
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-[var(--text-main)] leading-relaxed sm:leading-6 text-xs sm:text-sm break-words align-top">
                            {children}
                        </td>
                    ),
                    img: ({ src, alt, ...props }) => (
                        <figure className="my-5 sm:my-7 max-w-full w-full overflow-hidden rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] shadow-sm">
                            <div className="relative w-full flex items-center justify-center p-2 sm:p-4 bg-[var(--btn-surface)]/30 overflow-hidden">
                                <img
                                    src={src}
                                    alt={alt || 'Visual'}
                                    className="w-auto max-w-full h-auto max-h-[380px] sm:max-h-[520px] object-contain rounded-lg transition-transform duration-300 hover:scale-[1.01]"
                                    loading="lazy"
                                    {...props}
                                />
                            </div>
                            {alt && (
                                <figcaption className="px-3.5 py-2 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-glass)] bg-[var(--btn-surface)] font-medium">
                                    {alt}
                                </figcaption>
                            )}
                        </figure>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default CitationsMarkdownRenderer;
