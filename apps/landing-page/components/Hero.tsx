'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, Play, Users, FileText, FlaskConical,
  Cpu, Layers, CheckCircle2, LineChart, Code2, BookOpen, ExternalLink, Shield
} from 'lucide-react';
import Link from 'next/link';
import LiveResearchBar from './LiveResearchBar';

export default function Hero() {
  const [activeMockTab, setActiveMockTab] = useState<'synthesis' | 'simulation' | 'citations' | 'thesis'>('simulation');

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-[#030305] text-black dark:text-white pt-32 pb-20">
      {/* Animated mesh gradient background */}
      <div className="mesh-gradient" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">
              Tafiti AI • Built-in Python Simulation Studio &amp; Smart Citations
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.08]"
          >
            The AI Research Copilot for{' '}
            <span className="gradient-text">Scientists &amp; Scholars</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light"
          >
            Accelerate your academic journey from rough hypothesis to defended thesis. Deep literature synthesis across 250M+ papers, Scite-style smart citations, built-in scientific Python simulations, and real-time collaboration.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14"
          >
            <a
              href="https://app.tafitiai.co.ke"
              className="w-full sm:w-auto group flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-8 py-4 rounded-2xl font-bold text-base sm:text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/25"
            >
              <span>Start Free Research</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              href="/demo"
              className="w-full sm:w-auto group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base sm:text-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-gray-800 dark:text-white"
            >
              <Cpu className="w-5 h-5 text-emerald-400" />
              <span>Test-Drive Simulation</span>
            </Link>
          </motion.div>

          {/* Key Metrics / Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-16"
          >
            {[
              { value: '250M+', label: 'Papers Indexed', sub: 'OpenAlex, CORE, AfricArXiv' },
              { value: '100%', label: 'Zero Hallucinations', sub: 'Ground-truth DOI links' },
              { value: 'Python', label: 'Built-in Simulation', sub: 'ODE, Monte Carlo & Biostats' },
              { value: 'KES 200', label: 'Accessible Pricing', sub: '~$1.50/mo with M-Pesa' },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-2xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5">
                <div className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-xs sm:text-sm font-semibold text-indigo-500 dark:text-indigo-400 mt-0.5">{stat.label}</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </motion.div>

          {/* ── INTERACTIVE PRODUCT PREVIEW WINDOW ── */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="relative max-w-5xl mx-auto text-left"
          >
            <div className="rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-2xl bg-white dark:bg-[#0a0a0f] glass">
              {/* Window Chrome & Interactive Navigation Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-gray-100/90 dark:bg-[#0d0d14] border-b border-gray-200 dark:border-white/5">
                {/* Traffic lights & URL */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 pl-2">
                    tafiti-ai // research-workspace
                  </span>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'simulation', label: 'Python Simulation Studio', icon: Cpu },
                    { id: 'synthesis', label: 'Literature Synthesis', icon: Sparkles },
                    { id: 'citations', label: 'Smart Citations', icon: Layers },
                    { id: 'thesis', label: 'Thesis Editor', icon: BookOpen },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMockTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeMockTab === tab.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB CONTENT ── */}
              <div className="p-6 md:p-8 min-h-[420px] bg-gray-50/50 dark:bg-[#060609]">
                {/* 1. Simulation Tab */}
                {activeMockTab === 'simulation' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-fade-in">
                    {/* Left: Code Snippet */}
                    <div className="md:col-span-6 rounded-2xl bg-[#0a0a0f] p-4 border border-white/10 font-mono text-xs text-slate-300 space-y-2 overflow-x-auto">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-white/5 font-sans">
                        <span className="flex items-center gap-1 text-emerald-400 font-mono">
                          <Code2 className="w-3.5 h-3.5" /> sir_epidemiology.py
                        </span>
                        <span className="text-emerald-400 font-bold">● Running sandbox</span>
                      </div>
                      <p className="text-purple-400">from scipy.integrate import odeint</p>
                      <p className="text-purple-400">import matplotlib.pyplot as plt</p>
                      <p className="text-slate-500"># Model malaria transmission with bednets</p>
                      <p><span className="text-indigo-400">N</span> = 100_000, <span className="text-indigo-400">beta</span> = 0.35, <span className="text-indigo-400">gamma</span> = 0.10</p>
                      <p><span className="text-sky-400">R0</span> = beta / gamma  <span className="text-slate-500"># Basic Reproduction: 3.50</span></p>
                      <p className="text-slate-400">sol = odeint(deriv, y0, t, args=(N, beta, gamma))</p>
                      <p className="text-emerald-400">plt.plot(t, sol[:, 1], label=&quot;Infected (I)&quot;)</p>
                      <p className="text-slate-300">plt.show()</p>
                      <div className="pt-2 text-[11px] text-emerald-400 font-mono bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                        &gt; Peak Day: 42 | Estimated Mortality Reduction: 43.8%
                      </div>
                    </div>

                    {/* Right: Live Figure Mock */}
                    <div className="md:col-span-6 rounded-2xl bg-white dark:bg-[#0d0d14] p-5 border border-gray-200 dark:border-white/10 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 dark:text-white">SIR Epidemiological Trajectory</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[10px] font-mono">
                          R₀ = 3.50
                        </span>
                      </div>
                      <div className="h-44 w-full relative">
                        <svg viewBox="0 0 400 160" className="w-full h-full">
                          <line x1="20" y1="20" x2="380" y2="20" stroke="#00000010" strokeDasharray="3 3" className="dark:stroke-white/10" />
                          <line x1="20" y1="80" x2="380" y2="80" stroke="#00000010" strokeDasharray="3 3" className="dark:stroke-white/10" />
                          <line x1="20" y1="140" x2="380" y2="140" stroke="#00000020" className="dark:stroke-white/20" />
                          {/* Susceptible */}
                          <path d="M 20 30 Q 120 100 380 135" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                          {/* Infected */}
                          <path d="M 20 135 Q 120 25 180 25 T 380 135" fill="none" stroke="#f43f5e" strokeWidth="3" />
                          {/* Recovered */}
                          <path d="M 20 135 Q 160 130 380 40" fill="none" stroke="#10b981" strokeWidth="2.5" />
                        </svg>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-white/5">
                        <span className="text-emerald-600 dark:text-emerald-400">✓ Graph auto-streamed from sandbox</span>
                        <span className="px-3 py-1 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-lg font-bold cursor-pointer hover:bg-indigo-500/20">
                          Insert to Thesis Chapter
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Synthesis Tab */}
                {activeMockTab === 'synthesis' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Research Topic:</span>
                      <span className="text-xs text-gray-800 dark:text-slate-300 font-medium">Solar-powered drip irrigation in sub-Saharan semi-arid zones</span>
                      <span className="text-[10px] bg-indigo-600/10 dark:bg-white/10 text-indigo-700 dark:text-white px-2 py-0.5 rounded font-mono">14 Sources Synthesized</span>
                    </div>
                    <div className="p-5 rounded-2xl bg-white dark:bg-[#0a0a0f] border border-gray-200 dark:border-white/10 space-y-3">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Executive Evidence Synthesis
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                        Cross-sectional synthesis across 14 peer-reviewed trials confirms that solar-powered micro-drip irrigation systems improve smallholder maize yields by <strong className="text-indigo-600 dark:text-indigo-400">38.4% (95% CI: 31.2–45.6%)</strong> while reducing seasonal groundwater consumption by <strong className="text-emerald-600 dark:text-emerald-400">52.1%</strong> compared to traditional surface flooding [Mwangi et al., 2023; FAO, 2024].
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">PICO Validated</span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Quantitative Consensus</span>
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">Sub-Saharan Focus</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Smart Citations Tab */}
                {activeMockTab === 'citations' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-[#0a0a0f] border border-gray-200 dark:border-white/10 text-xs">
                      <span className="text-gray-500 dark:text-slate-500 font-bold uppercase text-[10px] block mb-1">Claim in Thesis Manuscript:</span>
                      <span className="text-gray-900 dark:text-white font-medium">&quot;Community health worker mobile diagnostic algorithms lower rural neonatal referral delays.&quot;</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Supporting Evidence (98% Conf)
                        </span>
                        <p className="text-xs text-gray-700 dark:text-slate-300 italic">
                          &quot;A cluster randomized trial in Western Uganda demonstrated a 64% reduction in referral delay (p &lt; 0.001) using smartphone triage.&quot;
                        </p>
                        <span className="text-[10px] text-gray-500 dark:text-slate-500 block">The Lancet Global Health (2023)</span>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center gap-1 w-fit">
                          <Shield className="w-3 h-3" /> Contrasting Boundary Condition (89% Conf)
                        </span>
                        <p className="text-xs text-gray-700 dark:text-slate-300 italic">
                          &quot;In areas with zero cellular connectivity, battery life constraints diminished the diagnostic speed benefit by 41%.&quot;
                        </p>
                        <span className="text-[10px] text-gray-500 dark:text-slate-500 block">Health Policy &amp; Planning (2024)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Thesis Editor Tab */}
                {activeMockTab === 'thesis' && (
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#0a0a0f] border border-gray-200 dark:border-white/10 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">Chapter 3: Methodology &amp; Mathematical Formulation</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">CRDT Active</span>
                      </div>
                      <div className="flex items-center -space-x-1.5">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">AM</div>
                        <div className="w-6 h-6 rounded-full bg-purple-500 text-[10px] text-white flex items-center justify-center font-bold">KO</div>
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-[10px] text-white flex items-center justify-center font-bold">+2</div>
                      </div>
                    </div>
                    <div className="font-serif text-xs text-gray-700 dark:text-slate-300 leading-relaxed space-y-2">
                      <p>
                        To formulate the transmission dynamics under stochastic precipitation conditions, we establish the ordinary differential operator:
                      </p>
                      <div className="p-3 bg-gray-100 dark:bg-white/[0.03] rounded-xl font-mono text-center text-indigo-400 text-xs">
                        dS/dt = -β · S · I / N, &nbsp;&nbsp;&nbsp; dI/dt = β · S · I / N - γ · I
                      </div>
                      <p>
                        Parameter estimations derived from our built-in Python simulation studio converge at R₀ = 3.50, substantiating the alternative hypothesis H₁.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
                      <span className="text-indigo-400 font-sans font-medium">AI Thesis Copilot: &quot;Argumentation is rigorous. 3 citations inserted automatically.&quot;</span>
                      <span className="text-xs font-bold text-white bg-indigo-600 px-2.5 py-1 rounded-lg">Export PDF</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Glow under mockup */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-4/5 h-20 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
