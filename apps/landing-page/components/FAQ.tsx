'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: 'How is Tafiti AI different from ChatGPT or Perplexity?',
    answer: 'Tafiti AI is purpose-built for academic research. Unlike general chatbots, it accesses real-time academic databases (OpenAlex, CORE, Scopus), classifies citations as Supporting/Contrasting/Mentioning, runs Python simulations in-browser, and provides systematic review tools with PRISMA compliance. It also spawns adaptive AI agents that work like a research team.',
  },
  {
    question: 'What academic databases does Tafiti search?',
    answer: 'We index papers from OpenAlex, Semantic Scholar, CORE, Scopus, DOAJ, AJOL, and AfricArXiv. We also search the open web and institutional repositories. Our coverage includes 250M+ academic papers across all disciplines.',
  },
  {
    question: 'Can I use Tafiti AI for my thesis or dissertation?',
    answer: 'Absolutely! Our thesis editor includes AI writing assistance (summarize, improve clarity, add transitions), citation insertion with APA/MLA/Chicago/Harvard formatting, outline generation, real-time collaboration via CRDT sync, and Syncfusion-powered rich text editing. It\'s designed specifically for academic writing.',
  },
  {
    question: 'How does the code sandbox work?',
    answer: 'Our sandbox runs Python code in a secure browser environment with numpy, scipy, matplotlib, and pandas pre-installed. We provide 7+ scientific simulation templates (SIR epidemiology, Monte Carlo, power analysis, pharmacokinetics, meta-analysis, survey design, time series) and you can also write custom code. You can also use the AI to generate simulation code from your hypothesis.',
  },
  {
    question: 'Is my research data private?',
    answer: 'Yes. We use enterprise-grade encryption (AES-256 at rest, TLS 1.3 in transit). Your queries and data are never used to train public models. We\'re building toward SOC 2 compliance and support institutional data governance requirements.',
  },
  {
    question: 'Can I collaborate with my research team in real-time?',
    answer: 'Yes! Our thesis editor supports real-time collaboration with CRDT-based conflict resolution (no overwrites), presence indicators, cursor tracking, and role-based permissions (Owner/Editor/Viewer). It\'s like Google Docs but designed for academic writing.',
  },
  {
    question: 'How does the systematic review tool work?',
    answer: 'Our systematic review suite includes: PICO element extraction with MeSH search terms, AI-generated inclusion/exclusion criteria, single-paper screening against your criteria, and PRISMA 2020 flow diagram generation. It follows Cochrane and PRISMA guidelines.',
  },
  {
    question: 'What citation styles are supported?',
    answer: 'We support APA 7th, MLA 9th, Chicago, Harvard, Vancouver, and IEEE citation styles. You can insert inline citations, generate formatted reference lists, and create full bibliographies — all auto-sorted and formatted.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 md:py-32 bg-gray-50/50 dark:bg-white/[0.01] relative">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-6"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">FAQ</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
          >
            Common{' '}
            <span className="gradient-text">Questions</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            Everything you need to know about Tafiti AI.
          </motion.p>
        </div>

        {/* FAQ items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none group"
              >
                <span className="text-base font-semibold text-gray-900 dark:text-white pr-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {faq.question}
                </span>
                <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  {openIndex === index ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </span>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-6 text-sm text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-white/5 pt-4">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
