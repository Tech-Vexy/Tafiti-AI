import Hero from "@/components/Hero";
import CTA from "@/components/CTA";


export default function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-black selection:bg-purple-500/30">
      <Hero />
      <CTA />
    </main>
  );
}
