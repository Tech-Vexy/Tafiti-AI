import Hero from "@/components/Hero";
import LogoCloud from "@/components/LogoCloud";
import InteractiveDemo from "@/components/InteractiveDemo";
import Features from "@/components/Features";
import Comparison from "@/components/Comparison";
import HowItWorks from "@/components/HowItWorks";
import Stats from "@/components/Stats";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";

export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#030305] selection:bg-indigo-500/30">
      <Hero />
      <LogoCloud />
      <InteractiveDemo />
      <Features />
      <Comparison />
      <HowItWorks />
      <Stats />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </main>
  );
}
