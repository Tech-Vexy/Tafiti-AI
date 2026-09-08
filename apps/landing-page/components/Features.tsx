'use client';

import { motion } from 'framer-motion';
import {
  Cpu, Layers, BookOpen, GitBranch, Globe2, ShieldCheck,
  Sparkles, CheckCircle2, ArrowRight, Code2, LineChart,
  Sliders, Users, FileText, Check, AlertCircle, Zap
} from 'lucide-react';
import Link from 'next/link';

export default function Features() {
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
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">Tafiti AI Core Capabilities</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Engineered for <span className="gradient-text">Rigorous Science</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            Unlike generic chatbots that summarize text, Tafiti AI executes computational simulations, validates evidence stances, and powers collaborative thesis drafting.
          </motion.p>
        </div>

        {/* ── BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-6xl mx-auto">
          {/* BENTO 1: Large Card — Scientific Simulation & Code Sandbox */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="md:col-span-7 rounded-3xl p-8 md:p-10 glass border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between relative overflow-hidden group shadow-xl"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[90px] pointer-events-none rounded-full" />
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 block">
                Flagship Capability
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Built-in Scientific Python Simulation Studio
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Run ODE epidemiological models, Monte Carlo climate/crop risk analysis, and statistical power sample size curves inside an isolated sandbox. Generated matplotlib figures stream straight into your thesis chapter.
              </p>
            </div>

            {/* Code / Visual Preview */}
            <div className="mt-8 rounded-2xl bg-[#0a0a0f] border border-white/10 p-5 space-y-3 relative z-10">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-white/5 pb-2">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> sir_transmission_dynamics.py
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">R₀ = 3.50</span>
              </div>
              <div className="font-mono text-xs text-slate-300 space-y-1">
                <p><span className="text-indigo-400">sol</span> = odeint(deriv, y0, t, args=(N, beta, gamma))</p>
                <p><span className="text-emerald-400">plt.plot</span>(t, sol[:, 1], label=&apos;Infected (I)&apos;)</p>
              </div>
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-slate-500">Supports NumPy, SciPy, Pandas, Matplotlib, SymPy</span>
                <Link href="/demo" className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  <span>Try Demo</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </motion.div>

          {/* BENTO 2: Large Card — Scite-Style Smart Citations */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-5 rounded-3xl p-8 md:p-10 glass border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex flex-col justify-between relative overflow-hidden group shadow-xl"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full" />
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400 block">
                Evidence Verification
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Smart Citations &amp; Claim Stances
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Tafiti AI classifies every cited paper as <strong className="text-emerald-400">Supporting</strong>, <strong className="text-rose-400">Contrasting</strong>, or <strong className="text-slate-400">Mentioning</strong>. Never defend a thesis with misinterpreted citations.
              </p>
            </div>

            {/* Smart Citation Badges Preview */}
            <div className="mt-8 space-y-3 relative z-10">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">Supporting Evidence</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">98% Confidence</span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-white">Contrasting / Conflict</span>
                </div>
                <span className="text-[10px] font-mono text-rose-400 font-bold">89% Confidence</span>
              </div>
            </div>
          </motion.div>

          {/* BENTO 3: Medium Card — Real-Time Thesis Editor & CRDT Collaboration */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-4 rounded-3xl p-8 glass border border-amber-500/20 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xl"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Collaborative Thesis Editor
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Sync with advisors and co-authors in real time via Yjs CRDT. Features chapter outline generation, LaTeX formula support, and Thesify-grade academic tone critique.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-400">
              <Users className="w-4 h-4" />
              <span>Multi-author real-time sync</span>
            </div>
          </motion.div>

          {/* BENTO 4: Medium Card — PRISMA Systematic Reviews & Study Matrix */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="md:col-span-4 rounded-3xl p-8 glass border border-purple-500/20 hover:border-purple-500/40 transition-all flex flex-col justify-between shadow-xl"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <GitBranch className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                PRISMA Systematic Review Matrix
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Rayyan &amp; Elicit-inspired automated study extraction: Extracts Population, Sample Size (N), Intervention, Effect Size, and Risk of Bias into structured comparison tables.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-purple-400">
              <FileText className="w-4 h-4" />
              <span>PICO-compliant review workflows</span>
            </div>
          </motion.div>

          {/* BENTO 5: Medium Card — Indigenous African & Global South Research */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="md:col-span-4 rounded-3xl p-8 glass border border-teal-500/20 hover:border-teal-500/40 transition-all flex flex-col justify-between shadow-xl"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Pan-African Literature Index
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Connects 250M+ global OpenAlex and CORE papers with indigenous repositories (AfricArXiv, AJOL) to eliminate Western publication bias.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-teal-400">
              <Check className="w-4 h-4" />
              <span>AJOL &amp; AfricArXiv Native Index</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
