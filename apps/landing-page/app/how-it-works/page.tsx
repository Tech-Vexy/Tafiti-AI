import { Metadata } from 'next';
import HowItWorks from '@/components/HowItWorks';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'How It Works - From Question to Publication | Tafiti AI',
  description: 'The four-stage academic research lifecycle with Tafiti AI: Discover & Formulate, Synthesize & Simulate, Draft & Critique, and Anchor & Publish.',
};

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <HowItWorks />
      <CTA />
    </main>
  );
}
