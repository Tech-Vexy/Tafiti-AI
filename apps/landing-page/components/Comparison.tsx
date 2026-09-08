'use client';

import { motion } from 'framer-motion';
import { Check, X, Sparkles, Shield, Cpu, Layers } from 'lucide-react';

const comparisonRows = [
  {
    feature: 'Built-in Python Simulation Sandbox (SIR, Monte Carlo, Power curves)',
    tafiti: true,
    chatgpt: false,
    scholar: false,
    elicit: false,
  },
  {
    feature: 'Smart Citations (Supporting vs Contrasting Claim Classification)',
    tafiti: true,
    chatgpt: false,
    scholar: false,
    elicit: 'Partial',
  },
  {
    feature: 'Zero Citation Hallucinations (Real OpenAlex, CORE & Crossref DOI links)',
    tafiti: true,
    chatgpt: false,
    scholar: true,
    elicit: true,
  },
  {
    feature: 'Collaborative Thesis Editor with CRDT Multi-Author Sync',
    tafiti: true,
    chatgpt: false,
    scholar: false,
    elicit: false,
  },
  {
    feature: 'PRISMA-Compliant Systematic Reviews & Study Matrix Extraction',
    tafiti: true,
    chatgpt: false,
    scholar: false,
    elicit: true,
  },
  {
    feature: 'African & Indigenous Literature Inclusion (AfricArXiv & AJOL)',
    tafiti: true,
    chatgpt: false,
    scholar: 'Limited',
    elicit: false,
  },
  {
    feature: 'Cryptographic IPFS Timestamping & Manuscript Provenance',
    tafiti: true,
    chatgpt: false,
    scholar: false,
    elicit: false,
  },
  {
    feature: 'Accessible Regional Pricing (M-Pesa, KES 200 / $1.50 mo)',
    tafiti: true,
    chatgpt: false,
    scholar: true,
    elicit: false,
  },
];

export default function Comparison() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-[#030305] relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-6"
          >
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">Purpose-Built for Academics</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Why Researchers Choose <span className="gradient-text">Tafiti AI</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            Generic AI chatbots hallucinate citations and cannot execute code. Google Scholar lacks synthesis.
            Tafiti AI combines literature intelligence with execution.
          </motion.p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-5xl mx-auto overflow-x-auto rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl glass">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02]">
                <th className="p-5 md:p-6 text-sm font-bold text-gray-900 dark:text-white w-2/5">Capability</th>
                <th className="p-5 md:p-6 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-x border-indigo-500/20 w-1/5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Tafiti AI</span>
                  </div>
                </th>
                <th className="p-5 md:p-6 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center w-1/5">
                  ChatGPT / Generic AI
                </th>
                <th className="p-5 md:p-6 text-sm font-semibold text-gray-500 dark:text-gray-400 text-center w-1/5">
                  Google Scholar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5 text-xs sm:text-sm">
              {comparisonRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors"
                >
                  <td className="p-5 md:p-6 font-medium text-gray-800 dark:text-gray-200">
                    {row.feature}
                  </td>
                  <td className="p-5 md:p-6 bg-indigo-500/[0.04] border-x border-indigo-500/15 text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400">
                      <Check className="w-4 h-4" />
                    </div>
                  </td>
                  <td className="p-5 md:p-6 text-center text-gray-400">
                    {row.chatgpt === false ? (
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-500/10 text-rose-400">
                        <X className="w-4 h-4" />
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-400">{row.chatgpt}</span>
                    )}
                  </td>
                  <td className="p-5 md:p-6 text-center text-gray-400">
                    {row.scholar === true ? (
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : row.scholar === false ? (
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-500/10 text-rose-400">
                        <X className="w-4 h-4" />
                      </div>
                    ) : (
                      <span className="font-semibold text-gray-500">{row.scholar}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
