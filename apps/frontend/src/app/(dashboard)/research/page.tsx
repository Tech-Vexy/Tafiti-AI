import type { Metadata } from 'next';
import ResearchChat from './ResearchChat';

export const metadata: Metadata = {
  title: 'Academic Research Engine & Literature Synthesis',
  description: 'Explore 200M+ academic papers with citation grounding, AI gap analysis, systematic reviews, and African academic databases.',
  alternates: {
    canonical: '/research',
  },
  openGraph: {
    title: 'Academic Research Engine & Literature Synthesis | Tafiti AI',
    description: 'Explore 200M+ academic papers with citation grounding, AI gap analysis, and systematic reviews.',
    url: 'https://tafitiai.co.ke/research',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academic Research Engine | Tafiti AI',
    description: 'Grounded AI literature synthesis and systematic research across 200M+ peer-reviewed papers.',
  },
};

interface ResearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Page({ searchParams }: ResearchPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  return <ResearchChat initialQuery={resolvedParams?.q || ''} />;
}
