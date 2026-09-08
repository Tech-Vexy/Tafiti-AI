import { Metadata } from 'next';
import InteractiveDemo from '@/components/InteractiveDemo';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Interactive Playground - Tafiti AI',
  description: 'Test-drive the Tafiti AI research platform: run ODE epidemiological simulations, formulate PICO hypotheses, and verify citation stances directly in your browser.',
};

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <div className="container mx-auto px-4 pt-8 pb-4 text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-gray-900 dark:text-white">
          Interactive <span className="gradient-text">Research Playground</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Test drive Tafiti AI&apos;s computational simulation studio, hypothesis generator, and citation stance classifier without creating an account.
        </p>
      </div>

      <InteractiveDemo />
      <CTA />
    </main>
  );
}
