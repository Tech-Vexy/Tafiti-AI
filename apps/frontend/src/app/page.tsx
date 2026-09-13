import type { Metadata } from 'next';
import LandingPage from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Tafiti AI — Research Smarter. Publish Faster.',
  description: 'AI synthesis, gap analysis, and systematic review tools purpose-built for academic researchers across Africa and beyond.',
  keywords: [
    'Tafiti AI',
    'African academic research',
    'AI literature synthesis',
    'gap analysis',
    'systematic review',
    'PRISMA flow',
    'AJOL',
    'AfricArxiv',
    'thesis editor',
    'arXiv',
    'OpenAlex',
    'academic writing',
    'scholar AI',
  ],
  openGraph: {
    title: 'Tafiti AI — Research Smarter. Publish Faster.',
    description: 'AI synthesis, gap analysis, and systematic review tools purpose-built for academic researchers.',
    url: 'https://tafitiai.co.ke',
    siteName: 'Tafiti AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tafiti AI — Research Smarter. Publish Faster.',
    description: 'AI synthesis, gap analysis, and systematic review tools purpose-built for academic researchers across Africa.',
    creator: '@tafitiai',
  },
};

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/research');
  }

  return <LandingPage />;
}
