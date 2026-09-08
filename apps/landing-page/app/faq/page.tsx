import { Metadata } from 'next';
import FAQ from '@/components/FAQ';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions - Tafiti AI',
  description: 'Find answers about Tafiti AI accuracy, databases indexed, Python simulation engine, data privacy, citation formatting, and institutional deployment.',
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <div className="container mx-auto px-4 pt-8 pb-4 text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-gray-900 dark:text-white">
          Knowledge Base &amp; <span className="gradient-text">FAQ</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Everything you need to know about our data sources, mathematical models, academic integrity, and pricing.
        </p>
      </div>

      <FAQ />
      <CTA />
    </main>
  );
}
