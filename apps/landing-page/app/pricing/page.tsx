import { Metadata } from 'next';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Pricing & Institutional Plans - Tafiti AI',
  description: 'Simple, accessible research pricing: Free tier, Pro at KES 200/mo (~$1.50 USD) with M-Pesa and Card support, and custom Institutional campus licenses.',
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30 pt-28 pb-16">
      <Pricing />
      <FAQ />
      <CTA />
    </main>
  );
}
