'use client';

import { motion } from 'framer-motion';
import { Search, Brain, PenLine, Rocket, ArrowDown } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Discover',
    description: 'Search millions of papers across OpenAlex, Semantic Scholar, CORE, and Scopus. AI surfaces the most relevant work instantly.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    number: '02',
    icon: Brain,
    title: 'Analyze',
    description: 'AI agents synthesize findings, classify citations, extract data, and identify research gaps. You see the evidence chain, not just links.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    number: '03',
    icon: PenLine,
    title: 'Write',
    description: 'Thesis editor with AI writing assistance, citation insertion, outline generation, and real-time collaboration. CRDT keeps everyone in sync.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Publish',
    description: 'Export to PDF, anchor your work with cryptographic timestamps, share with collaborators, and submit with confidence.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32 bg-gray-50/50 dark:bg-white/[0.01] relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-6"
          >
            <Rocket className="w-4 h-4" />
            <span className="text-sm font-semibold">How It Works</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            From question to{' '}
            <span className="gradient-text">publication</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            Four steps. AI handles the discovery, analysis, and synthesis. You focus on the insight.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-0 md:grid md:grid-cols-4 md:gap-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative"
            >
              <div className={`p-6 md:p-8 rounded-3xl bg-white dark:bg-white/[0.02] border ${step.border} hover:shadow-lg transition-all h-full`}>
                {/* Step number */}
                <div className="text-5xl font-black text-gray-100 dark:text-white/5 mb-4">{step.number}</div>

                {/* Icon */}
                <div className={`w-12 h-12 ${step.bg} rounded-2xl flex items-center justify-center mb-4`}>
                  <step.icon className={`w-6 h-6 ${step.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.description}</p>
              </div>

              {/* Arrow connector (desktop only, not on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                  <ArrowDown className="w-5 h-5 text-gray-300 dark:text-gray-700 rotate-[-90deg]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
