'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CTA() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-[#030305] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-8">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Ready to start?</span>
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
            Your next breakthrough{' '}
            <br className="hidden md:block" />
            <span className="gradient-text">starts here</span>
          </h2>

          <p className="text-xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join 50,000+ researchers across Africa who are discovering papers, synthesizing evidence, and writing theses faster with Tafiti AI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="https://app.tafitiai.co.ke"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
            >
              Start Researching Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="mailto:hello@tafitiai.co.ke"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 font-bold text-lg transition-all"
            >
              Talk to Us
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
