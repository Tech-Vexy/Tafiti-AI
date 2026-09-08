import { Metadata } from 'next';
import Testimonials from '@/components/Testimonials';
import LogoCloud from '@/components/LogoCloud';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Researcher Stories & Case Studies - Tafiti AI',
  description: 'See how researchers, postdocs, and research labs across Africa and the world accelerate their scientific breakthroughs with Tafiti AI.',
};

export default function TestimonialsPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <div className="container mx-auto px-4 pt-8 pb-4 text-center max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-gray-900 dark:text-white">
          Trusted by <span className="gradient-text">World-Class Scholars</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          From PhD students drafting their first literature review to lab directors managing multi-center trials.
        </p>
      </div>

      <LogoCloud />
      <Testimonials />
      <CTA />
    </main>
  );
}
