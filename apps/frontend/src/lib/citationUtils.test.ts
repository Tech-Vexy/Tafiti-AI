import { describe, it, expect } from 'vitest'
import {
  parseName,
  abbreviateFirst,
  extractDomain,
  getSourceVenueOrDomain,
  getFaviconUrl,
  formatAPACitation,
  sanitizeStepLabel,
  extractCitationContextSnippet,
} from '@/lib/citationUtils'

describe('parseName', () => {
  it('handles empty input', () => {
    expect(parseName('')).toEqual({ first: '', last: 'Unknown' })
    expect(parseName()).toEqual({ first: '', last: 'Unknown' })
  })

  it('handles a single name', () => {
    expect(parseName('Chomsky')).toEqual({ first: '', last: 'Chomsky' })
  })

  it('splits first and last name', () => {
    expect(parseName('Noam Chomsky')).toEqual({ first: 'Noam', last: 'Chomsky' })
  })

  it('handles middle names', () => {
    expect(parseName('Alan Mathison Turing')).toEqual({ first: 'Alan Mathison', last: 'Turing' })
  })
})

describe('abbreviateFirst', () => {
  it('returns last name when no first name', () => {
    expect(abbreviateFirst('Chomsky')).toBe('Chomsky')
  })

  it('abbreviates initials with periods', () => {
    expect(abbreviateFirst('Noam Chomsky')).toBe('Chomsky, N.')
  })

  it('abbreviates hyphenated and multiple first names', () => {
    expect(abbreviateFirst('Mary Jane Watson')).toBe('Watson, M. J.')
  })
})

describe('extractDomain', () => {
  it('strips protocol and www prefix', () => {
    expect(extractDomain('https://www.nature.com/articles/x')).toBe('nature.com')
  })

  it('handles bare hosts', () => {
    expect(extractDomain('arxiv.org/abs/123')).toBe('arxiv.org')
  })

  it('maps vertex ai search hosts to google.com', () => {
    expect(extractDomain('https://vertexaisearch.cloud.google.com/grounding')).toBe('google.com')
  })

  it('falls back when URL is missing', () => {
    expect(extractDomain()).toBe('source.org')
  })

  it('falls back to academic.org on malformed URLs', () => {
    expect(extractDomain('not a url')).toBe('academic.org')
  })
})

describe('getSourceVenueOrDomain', () => {
  it('returns source when present', () => {
    expect(getSourceVenueOrDomain({ source: 'Nature' })).toBe('Nature')
  })

  it('prefers journal for scholarly items', () => {
    expect(getSourceVenueOrDomain({ journal: 'Science' })).toBe('Science')
  })

  it('extracts domain from URL when no venue metadata', () => {
    expect(getSourceVenueOrDomain({ url: 'https://www.pnas.org/doi/x' })).toBe('pnas.org')
  })

  it('returns Scholar Source for empty input', () => {
    expect(getSourceVenueOrDomain(null)).toBe('Scholar Source')
  })
})

describe('getFaviconUrl', () => {
  it('builds a Google favicon URL', () => {
    expect(getFaviconUrl('https://nature.com')).toContain('nature.com')
    expect(getFaviconUrl('https://nature.com')).toContain('s2/favicons')
  })

  it('accepts an explicit domain', () => {
    expect(getFaviconUrl(undefined, 'arxiv.org')).toContain('arxiv.org')
  })
})

describe('formatAPACitation', () => {
  it('returns empty string for empty input', () => {
    expect(formatAPACitation(null)).toBe('')
  })

  it('formats a single author', () => {
    const out = formatAPACitation({
      authors: ['Ada Lovelace'],
      year: 1843,
      title: 'Sketch of the Analytical Engine.',
      journal: 'Scientific Memoirs',
    })
    expect(out).toBe(
      'Lovelace, A. (1843). Sketch of the Analytical Engine. Scientific Memoirs. https://openalex.org/'
    )
  })

  it('formats two authors with ampersand', () => {
    const out = formatAPACitation({
      authors: ['Alan Turing', 'Noam Chomsky'],
      title: 'On computable numbers',
      journal: 'Proc. LMS',
    })
    expect(out).toMatch(/Turing, A\., & Chomsky, N\. \(n\.d\.\)\./)
  })

  it('uses the DOI over other URLs', () => {
    const out = formatAPACitation({ title: 'A paper', doi: '10.1000/xyz', journal: 'J' })
    expect(out).toContain('https://doi.org/10.1000/xyz')
  })
})

describe('sanitizeStepLabel', () => {
  it('returns a default for empty input', () => {
    expect(sanitizeStepLabel()).toBe('Deep Research')
    expect(sanitizeStepLabel('')).toBe('Deep Research')
  })

  it('strips model/version noise from labels', () => {
    const out = sanitizeStepLabel('Autonomous deep-research-preview-04-2026 analysis')
    expect(out).not.toMatch(/preview|gemini|gpt/)
    expect(out.toLowerCase()).toContain('analysis')
  })

  it('strips parenthesized preview notes', () => {
    const out = sanitizeStepLabel('Query expansion (gemini-2.5-pro)')
    expect(out).toContain('Query expansion')
    expect(out).not.toContain('gemini-2.5-pro')
  })

  it('keeps plain labels intact', () => {
    expect(sanitizeStepLabel('Synthesizing findings')).toBe('Synthesizing findings')
  })
})

describe('extractCitationContextSnippet', () => {
  it('returns null for empty content', () => {
    expect(extractCitationContextSnippet('', 'https://a.org', 'A', 1)).toBeNull()
  })

  it('extracts the sentence containing a cited URL', () => {
    const content =
      'Earlier work established the baseline. This claim is supported by the data (https://example.org/paper). It was later replicated broadly.'
    const snippet = extractCitationContextSnippet(content, 'https://example.org/paper', 'Example', 1)
    expect(snippet).toBe('This claim is supported by the data.')
  })

  it('matches numeric citation markers', () => {
    const content = 'Multiple studies confirm the effect [2] and extend it to new domains.'
    const snippet = extractCitationContextSnippet(content, '', 'Some Source', 2)
    expect(snippet).toBe('Multiple studies confirm the effect and extend it to new domains.')
  })
})