import { Metadata } from 'next';
import Features from '@/components/Features';
import Comparison from '@/components/Comparison';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Platform Capabilities & Bento Features - Tafiti AI',
  description: 'Deep dive into Tafiti AI capabilities: Python Simulation Sandbox, Scite-style Smart Citations, CRDT Collaborative Thesis Editor, and PRISMA systematic reviews.',
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <Features />
      <Comparison />
      <CTA />
    </main>
  );
}
