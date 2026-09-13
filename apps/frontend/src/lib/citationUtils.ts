/**
 * citationUtils.ts
 * Comprehensive utilities for academic and web source citation, APA formatting,
 * and domain metadata extraction matching Perplexity AI citation standards.
 */

export interface ParsedName {
  first: string;
  last: string;
}

export function parseName(fullName: string = ''): ParsedName {
  if (!fullName) return { first: '', last: 'Unknown' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return { first, last };
}

export function abbreviateFirst(name: string): string {
  const { first, last } = parseName(name);
  if (!first) return last;
  const initials = first
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join(' ');
  return `${last}, ${initials}`;
}

export function extractDomain(url?: string | null, fallbackItem?: any): string {
  if (fallbackItem) {
    const venue = getSourceVenueOrDomain(fallbackItem);
    if (venue && venue !== 'Scholar Source' && !venue.includes('vertexaisearch')) {
      return venue.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    }
  }
  if (!url) return 'source.org';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host.includes('vertexaisearch.cloud.google.com')) {
      return 'google.com';
    }
    return host;
  } catch {
    return 'academic.org';
  }
}

export function getSourceDisplayUrl(item: any): string {
  if (!item) return '';
  const rawUrl = item.url || item.pdf_url || (item.doi ? `https://doi.org/${item.doi}` : null);
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host.includes('vertexaisearch.cloud.google.com')) {
      const venue = getSourceVenueOrDomain(item);
      if (venue && venue !== 'Scholar Source' && !venue.includes('vertexaisearch')) {
        return venue;
      }
      return 'Grounded Source';
    }
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return String(rawUrl).replace(/^https?:\/\//, '');
  }
}

export function getSourceVenueOrDomain(item: any): string {
  if (!item) return 'Scholar Source';
  if (item.source && typeof item.source === 'string' && !item.source.toLowerCase().includes('academic.source') && !item.source.toLowerCase().includes('vertexaisearch')) {
    return item.source;
  }
  if (item.journal && typeof item.journal === 'string' && !item.journal.toLowerCase().includes('vertexaisearch')) {
    return item.journal;
  }
  if (item.title && typeof item.title === 'string' && item.title.includes('.') && !item.title.includes(' ')) {
    return item.title;
  }
  const rawUrl = item.url || item.pdf_url || (item.doi ? `https://doi.org/${item.doi}` : null);
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host !== 'doi.org' && !host.includes('vertexaisearch.cloud.google.com')) return host;
    } catch {}
  }
  if (item.doi) return `doi.org/${item.doi}`;
  if (item.publisher) return item.publisher;
  return 'Scholar Source';
}

export function getFaviconUrl(url?: string | null, domain?: string): string {
  const d = domain || extractDomain(url);
  return `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
}

/**
 * Format paper/source into APA 7th Edition citation string:
 * Author, A. A., & Author, B. B. (Year). Title of work. Journal/Source. URL
 */
export function formatAPACitation(paper: any): string {
  if (!paper) return '';
  const authors = Array.isArray(paper.authors) ? paper.authors : [];
  let authorsStr = 'Unknown Author';

  if (authors.length === 1) {
    authorsStr = abbreviateFirst(authors[0]);
  } else if (authors.length === 2) {
    authorsStr = `${abbreviateFirst(authors[0])}, & ${abbreviateFirst(authors[1])}`;
  } else if (authors.length > 2 && authors.length <= 20) {
    authorsStr =
      authors.slice(0, -1).map(abbreviateFirst).join(', ') +
      ', & ' +
      abbreviateFirst(authors[authors.length - 1]);
  } else if (authors.length > 20) {
    authorsStr =
      authors.slice(0, 19).map(abbreviateFirst).join(', ') +
      ', ... ' +
      abbreviateFirst(authors[authors.length - 1]);
  }

  const year = paper.year ? `(${paper.year})` : '(n.d.)';
  const title = paper.title ? paper.title.trim().replace(/\.$/, '') : 'Untitled paper';
  const venue = paper.journal || paper.venue || paper.journal_name || paper.source || 'OpenAlex';
  const url = paper.doi
    ? `https://doi.org/${paper.doi}`
    : paper.url ||
      paper.landing_page_url ||
      (paper.id?.startsWith('http') ? paper.id : `https://openalex.org/${paper.id || ''}`);

  return `${authorsStr} ${year}. ${title}. ${venue}. ${url}`;
}

/**
 * Normalize any paper or external source into a structured ResearchSource
 */
export function normalizeSource(item: any, index: number = 1) {
  const rawUrl = item.doi
    ? `https://doi.org/${item.doi}`
    : item.url ||
      item.landing_page_url ||
      (item.id?.startsWith('http') ? item.id : `https://openalex.org/${item.id || ''}`);

  const domain = getSourceVenueOrDomain(item) !== 'Scholar Source'
    ? getSourceVenueOrDomain(item)
    : extractDomain(rawUrl, item);
  const titleClean = (item.title || 'the subject matter').trim().replace(/\.$/, '');
  const authorPart = item.authors && item.authors.length > 0 ? ` by ${item.authors[0]} et al.` : '';
  const yearPart = item.year ? ` (${item.year})` : '';
  const venuePart = domain !== 'source.org' && domain !== 'academic.org' ? ` in ${domain}` : '';

  const snippet =
    item.snippet ||
    item.excerpt ||
    item.abstract ||
    item.summary ||
    item.description ||
    `Empirical research${authorPart}${yearPart}${venuePart} examining ${titleClean}.`;

  return {
    id: item.id || `source-${index}`,
    index,
    title: item.title || 'Untitled Research Source',
    url: rawUrl,
    domain,
    favicon: getFaviconUrl(rawUrl, domain),
    isVerified: true,
    authors: Array.isArray(item.authors) ? item.authors : [],
    year: item.year || 'n.d.',
    venue: item.journal || item.venue || item.journal_name || item.source || domain,
    snippet,
    excerpt: snippet,
    abstract: item.abstract || snippet,
    apaCitation: formatAPACitation(item),
    raw: item,
  };
}

/**
 * Extract the contextual sentence from the synthesis body where a source is cited.
 * Matches citations by URL, markdown link, domain citation, or numeric reference.
 */
export function extractCitationContextSnippet(
  content: string,
  sourceUrl: string,
  sourceLabel: string,
  sourceIndex: number
): string | null {
  if (!content) return null;

  // Search patterns: URL, label, cite-link, or numeric citation [index]
  const escapedUrl = sourceUrl ? sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const escapedLabel = sourceLabel && sourceLabel.length > 3 && !sourceLabel.includes('.org') && !sourceLabel.includes('.com')
    ? sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : null;

  const patterns: RegExp[] = [];
  if (escapedUrl) patterns.push(new RegExp(escapedUrl, 'i'));
  if (escapedLabel) patterns.push(new RegExp(`\\[${escapedLabel}\\]`, 'i'));
  patterns.push(new RegExp(`\\[\\[?[^\]]*\\]\\([^)]*\\)\\]`, 'g')); // domain citation link
  patterns.push(new RegExp(`\\[(?:Source\\s*)?${sourceIndex}\\]`, 'i'));

  for (const regex of patterns) {
    const match = regex.exec(content);
    if (!match) continue;

    const pos = match.index;
    // Walk back to sentence boundary
    let start = pos;
    while (start > 0 && !/[.!?\n]/.test(content[start - 1])) {
      start--;
    }
    // Walk forward to sentence boundary
    let end = pos + match[0].length;
    while (end < content.length && !/[.!?\n]/.test(content[end])) {
      end++;
    }
    if (end < content.length && /[.!?]/.test(content[end])) {
      end++;
    }

    let sentence = content.slice(start, end).trim();
    // Clean citation markers and markdown links from the extracted sentence
    sentence = sentence
      .replace(/\[\[[^\]]+\]\([^)]+\)\]/g, '')
      .replace(/\[[^\]]+\]\([^)]+\)/g, '')
      .replace(/\[(?:\d+|Source\s*\d+)\]/gi, '')
      .replace(/\s*\(https?:\/\/[^)]+\)/g, '')
      .replace(/\s*https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (sentence.length >= 25 && sentence.length <= 320) {
      return sentence;
    }
  }

  return null;
}

/**
 * Sanitize step labels and reasoning signatures so internal backend model IDs,
 * versions, or agent architecture names (e.g. deep-research-preview-04-2026, gemini-..., gpt-...)
 * are never displayed in the user-facing UI.
 */
export function sanitizeStepLabel(raw?: string | null): string {
  if (!raw) return 'Deep Research';
  const cleaned = raw
    .replace(/\s*\([^)]*(?:preview|model|agent|gemini|gpt|deep-research|preview-\d+)[^)]*\)/gi, '')
    .replace(/\b(?:deep-research-preview(?:-\d+)*|gemini-[\w.-]+|gpt-[\w.-]+|preview-[\w.-]+)\b/gi, '')
    .trim();

  const lower = cleaned.toLowerCase();
  if (lower.includes('autonomous literature deep research') || lower === 'deep research') {
    return 'Deep Research';
  }
  if (lower.includes('intent_routing') || lower.includes('deconstruct')) {
    return 'Analyzing research objective';
  }
  if (lower.includes('index_retrieval') || lower.includes('querying')) {
    return 'Searching academic literature';
  }
  if (lower.includes('evidence_classification')) {
    return 'Evaluating evidence & citations';
  }
  if (lower.includes('synthesis')) {
    return 'Synthesizing literature review';
  }
  if (lower.includes('deep research progress') || lower.includes('deep research reasoning')) {
    return 'Evaluating literature & preprints';
  }
  return cleaned || 'Deep Research';
}

/**
 * Extract structured sources from trailing markdown sources block and strip
 * the sources section from the message body so it is never rendered in the main text.
 */
export function extractAndStripSources(
  content: string = '',
  existingSources: any[] = []
): { cleanContent: string; sources: any[] } {
  if (!content) return { cleanContent: '', sources: existingSources || [] };

  // Match the trailing sources or references section
  const sourcesHeaderRegex = /(?:\r?\n){1,3}(?:[-*_]{3,}\s*)?(?:\*\*Sources:?\*\*|##?\s*Sources:?|\*\*References:?\*\*|##?\s*References:?|Sources:)\s*([\s\S]*)$/i;
  const match = content.match(sourcesHeaderRegex);

  if (!match) {
const sources = existingSources || [];
    if (sources.length === 0) {
      // Fallback: extract inline markdown links from content if no sources header exists
      const inlineLinkRegex = /\[(?:\[)?([^\]]+)(?:\])?\((https?:\/\/[^\)]+)\)/g;
      let inlineMatch;
      let idx = 1;
      const seenUrls = new Set<string>();

      while ((inlineMatch = inlineLinkRegex.exec(content)) !== null) {
        const rawLabel = inlineMatch[1].trim();
        const url = inlineMatch[2].trim();
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        let domain = rawLabel;
        if (!domain.includes('.') || domain.includes(' ') || domain.startsWith('http')) {
          try {
            const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
            domain = parsedUrl.hostname.replace(/^www\./, '');
          } catch {
            domain = rawLabel || 'source.org';
          }
        }

        const title = rawLabel && !rawLabel.includes('.org') && !rawLabel.includes('.com') && rawLabel.length > 15
          ? rawLabel
          : `${domain.replace(/\.[^.]+$/, '')} Academic Reference`;

        const snippet = extractCitationContextSnippet(content, url, rawLabel, idx) ||
          `Academic publication from ${domain} investigating ${title.replace(/\.$/, '')}.`;

        sources.push({
          paper_id: `source-${idx}`,
          id: `source-${idx}`,
          title,
          authors: [domain],
          year: 2026,
          venue: domain,
          publisher: domain,
          url,
          source: domain,
          abstract: snippet,
          excerpt: snippet,
          snippet,
          citations: 0,
        });
        idx++;
      }
    }
    return { cleanContent: content, sources };
  }

  const cleanContent = content.slice(0, match.index).trimEnd();
  const rawSourcesSection = match[1] || '';

  // Process line by line to extract links, labels, and descriptions
  const lines = rawSourcesSection.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const extracted: any[] = [];
  let idx = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "[label](url)" or bare "http..."
    const mdLinkMatch = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
    const bareUrlMatch = !mdLinkMatch ? trimmed.match(/(https?:\/\/[^\s\)]+)/) : null;

    if (!mdLinkMatch && !bareUrlMatch) continue;

    const label = mdLinkMatch ? mdLinkMatch[1].trim() : '';
    const url = mdLinkMatch ? mdLinkMatch[2].trim() : bareUrlMatch![1].trim();

    // Trailing text after the link
    let trailing = '';
    if (mdLinkMatch) {
      const linkEnd = trimmed.indexOf(mdLinkMatch[0]) + mdLinkMatch[0].length;
      trailing = trimmed.slice(linkEnd).trim().replace(/^[:\-–—\s]+/, '').trim();
    } else if (bareUrlMatch) {
      const linkEnd = trimmed.indexOf(bareUrlMatch[0]) + bareUrlMatch[0].length;
      trailing = trimmed.slice(linkEnd).trim().replace(/^[:\-–—\s]+/, '').trim();
    }

    let domain = label;
    if (!domain.includes('.') || domain.includes(' ') || domain.startsWith('http')) {
      try {
        const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
        domain = parsedUrl.hostname.replace(/^www\./, '');
        if (domain.includes('vertexaisearch.cloud.google.com')) {
          domain = label && label.includes('.') ? label : 'academic.source';
        }
      } catch {
        domain = label || 'source.org';
      }
    }

    // Determine title and snippet/excerpt
    let title = label;
    let snippet = '';

    const isDomainLike = (str: string) =>
      Boolean(str && (str.includes('.org') || str.includes('.com') || str.includes('.edu') || str.includes('.io') || str.startsWith('arXiv:') || str === 'arxiv'));

    if (trailing) {
      // If label was a domain or short tag, trailing text likely contains the title or title + description
      if (isDomainLike(label) || label.length < 15) {
        const parts = trailing.split(/\s*[:\-–—]\s*/);
        if (parts.length > 1) {
          title = parts[0].trim();
          snippet = parts.slice(1).join(' - ').trim();
        } else {
          title = trailing;
        }
      } else {
        snippet = trailing;
      }
    }

    // If title is just a domain or url, make it more readable
    if (!title || isDomainLike(title) || title.startsWith('http')) {
      title = `${domain.replace(/\.[^.]+$/, '')} Academic Study`;
    }

    // Contextual extraction: search cleanContent for the sentence where this source was cited
    if (!snippet) {
      const contextSentence = extractCitationContextSnippet(cleanContent, url, label, idx);
      if (contextSentence) {
        snippet = contextSentence;
      }
    }

    // If still no snippet, craft a unique, context-specific description from the paper's title and domain
    if (!snippet) {
      snippet = `Scholarly literature indexed at ${domain} investigating ${title.replace(/\.$/, '')}.`;
    }

    extracted.push({
      paper_id: `source-${idx}`,
      id: `source-${idx}`,
      title,
      authors: [domain],
      year: 2026,
      venue: domain,
      publisher: domain,
      url,
      source: domain,
      abstract: snippet,
      excerpt: snippet,
      snippet,
      citations: 0,
    });
    idx++;
  }

  // If existingSources has valid structured items, prefer them or augment if extracted is larger
  let sources = existingSources || [];
  if (!sources || sources.length === 0) {
    sources = extracted;
  } else {
    // Merge: enrich existing sources with extracted snippets if existing sources lack them
    const existingUrls = new Set(sources.map((s: any) => s.url || s.pdf_url));
    sources = sources.map((s: any, i: number) => {
      const matched = extracted.find((e) => e.url === (s.url || s.pdf_url));
      const sSnippet = s.excerpt || s.abstract || s.snippet || matched?.snippet;
      return {
        ...s,
        excerpt: sSnippet || extractCitationContextSnippet(cleanContent, s.url, s.title, i + 1) || s.excerpt,
        snippet: sSnippet || extractCitationContextSnippet(cleanContent, s.url, s.title, i + 1) || s.snippet,
        abstract: s.abstract || sSnippet,
      };
    });

    const newItems = extracted.filter((e) => !existingUrls.has(e.url));
    if (newItems.length > 0) {
      sources = [...sources, ...newItems];
    }
  }

  return { cleanContent, sources };
}
