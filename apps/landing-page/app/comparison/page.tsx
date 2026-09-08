import { Metadata } from 'next';
import Comparison from '@/components/Comparison';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Why Tafiti AI vs Generic Chatbots - Tafiti AI',
  description: 'Understand how Tafiti AI surpasses generic LLMs, Google Scholar, and standalone citation managers with real code execution and PRISMA systematic reviews.',
};

export default function ComparisonPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <div className="container mx-auto px-4 pt-8 pb-4 text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-gray-900 dark:text-white">
          Why Researchers Choose <span className="gradient-text">Tafiti AI</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Generic AI chatbots hallucinate citations and cannot execute code. Explore our technical architecture and side-by-side benchmark comparison.
        </p>
      </div>

      <Comparison />
      <CTA />
    </main>
  );
}
