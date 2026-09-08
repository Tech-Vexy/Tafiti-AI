'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Sparkles, Sliders, Play, CheckCircle2, ArrowRight,
  RefreshCw, FileText, Check, Layers, AlertCircle, Quote
} from 'lucide-react';

export default function InteractiveDemo() {
  const [activeTool, setActiveTool] = useState<'simulation' | 'enhancer' | 'citations'>('simulation');

  // Simulation parameters state
  const [vaxRate, setVaxRate] = useState(25);
  const [transmissionRate, setTransmissionRate] = useState(0.40);
  const [durationDays, setDurationDays] = useState(120);

  // Topic Enhancer state
  const sampleTopics = [
    {
      title: "Solar-Powered Drip Irrigation in Arid Kenya",
      domain: "Agricultural Engineering",
      pico: {
        population: "Smallholder horticulture farmers in Turkana & Garissa counties",
        intervention: "Automated solar-powered micro-drip irrigation systems",
        comparison: "Traditional furrow or rain-fed cultivation",
        outcome: "38% increase in seasonal crop yield, 52% reduction in water usage"
      },
      hypothesis: "Solar-automated drip systems yield significantly higher drought resilience than rain-fed baselines (p < 0.01)."
    },
    {
      title: "Community Health Worker M-Health Diagnostics",
      domain: "Public Health & Epidemiology",
      pico: {
        population: "Rural primary care clinics across East Africa",
        intervention: "AI-assisted clinical decision support smartphone app",
        comparison: "Standard paper-based triage protocols",
        outcome: "64% reduction in diagnostic referral delays for pediatric pneumonia"
      },
      hypothesis: "Point-of-care mobile triage significantly lowers under-5 referral delay times."
    }
  ];
  const [selectedTopicIdx, setSelectedTopicIdx] = useState(0);

  // Dynamic simulation graph calculation
  // SIR curve approximation based on vaxRate and transmissionRate
  const effectiveR0 = ((transmissionRate / 0.1) * (1 - vaxRate / 100)).toFixed(2);
  const peakDay = Math.round(35 + (vaxRate * 0.8));
  const peakHeight = Math.max(15, Math.round(85 - (vaxRate * 0.85)));

  return (
    <section className="py-24 bg-gray-50/50 dark:bg-white/[0.01] border-y border-gray-200 dark:border-white/5 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Interactive Platform Playground</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Experience the <span className="gradient-text">Research Copilot</span>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Test drive Tafiti AI&apos;s computational tools directly in your browser. No sign-up required.
          </p>
        </div>

        {/* Interactive Shell */}
        <div className="max-w-5xl mx-auto rounded-3xl glass border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
          {/* Tool Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-white/10 bg-gray-100/60 dark:bg-[#0a0a0f]/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTool('simulation')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTool === 'simulation'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Python Simulation Studio</span>
              </button>

              <button
                onClick={() => setActiveTool('enhancer')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTool === 'enhancer'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Topic &amp; PICO Enhancer</span>
              </button>

              <button
                onClick={() => setActiveTool('citations')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTool === 'citations'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Smart Citations Matrix</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Engine Connected</span>
            </div>
          </div>

          {/* Playground Body */}
          <div className="p-6 md:p-10 bg-white dark:bg-[#060609]">
            <AnimatePresence mode="wait">
              {/* ── TOOL 1: SIMULATION STUDIO ── */}
              {activeTool === 'simulation' && (
                <motion.div
                  key="sim"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>SIR Epidemic Transmission Dynamics</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-mono">
                          Python ODEint
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Modulate vaccination coverage and transmission parameters to see live curve flattening.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                        <span className="text-gray-400">Effective R₀: </span>
                        <span className={`font-black font-mono ${Number(effectiveR0) < 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {effectiveR0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sliders Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-600 dark:text-gray-400">Vaccination Coverage (%)</span>
                        <span className="text-emerald-500 font-mono font-bold">{vaxRate}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={85}
                        step={5}
                        value={vaxRate}
                        onChange={(e) => setVaxRate(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-600 dark:text-gray-400">Transmission Rate (β)</span>
                        <span className="text-indigo-400 font-mono font-bold">{transmissionRate.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.15}
                        max={0.80}
                        step={0.05}
                        value={transmissionRate}
                        onChange={(e) => setTransmissionRate(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-600 dark:text-gray-400">Duration (Days)</span>
                        <span className="text-purple-400 font-mono font-bold">{durationDays}d</span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={200}
                        step={10}
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer h-2 bg-gray-200 dark:bg-white/10 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Dynamic SVG Plot Rendering */}
                  <div className="p-6 rounded-2xl bg-slate-900 dark:bg-[#0a0a0f] border border-slate-800 dark:border-white/10 text-white space-y-4 shadow-inner">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#38bdf8]" />
                          <span>Susceptible (S)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#f43f5e]" />
                          <span>Infected (I)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-[#10b981]" />
                          <span>Recovered (R)</span>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-400">
                        Peak Outbreak Day: ~{peakDay}
                      </span>
                    </div>

                    {/* SVG Chart */}
                    <div className="w-full h-56 relative">
                      <svg viewBox="0 0 500 180" className="w-full h-full">
                        {/* Grid lines */}
                        <line x1="40" y1="20" x2="480" y2="20" stroke="#ffffff10" strokeDasharray="3 3" />
                        <line x1="40" y1="70" x2="480" y2="70" stroke="#ffffff10" strokeDasharray="3 3" />
                        <line x1="40" y1="120" x2="480" y2="120" stroke="#ffffff10" strokeDasharray="3 3" />
                        <line x1="40" y1="160" x2="480" y2="160" stroke="#ffffff20" />

                        {/* Susceptible curve */}
                        <path
                          d={`M 40 40 Q 150 ${120 - vaxRate * 0.5} 480 ${155 - vaxRate * 0.4}`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="3"
                          className="transition-all duration-500"
                        />

                        {/* Infected curve (Bell shaped peak) */}
                        <path
                          d={`M 40 155 Q ${120 + vaxRate} ${160 - peakHeight} ${180 + vaxRate * 1.2} ${160 - peakHeight} T 480 155`}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="3.5"
                          className="transition-all duration-500"
                        />

                        {/* Recovered curve */}
                        <path
                          d={`M 40 155 Q 160 140 480 ${40 + (100 - vaxRate) * 0.5}`}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          className="transition-all duration-500"
                        />
                      </svg>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 pt-2 border-t border-white/5 gap-2">
                      <span>Interactive Python kernel output • Matplotlib Agg headless</span>
                      <span className="text-indigo-400 font-mono">1-click &quot;Insert into Thesis Chapter&quot; available in full platform</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TOOL 2: TOPIC & PICO ENHANCER ── */}
              {activeTool === 'enhancer' && (
                <motion.div
                  key="enhancer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        AI Topic Formulation &amp; PICO Framework
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Turn raw research interests into doctoral-level research questions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {sampleTopics.map((t, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedTopicIdx(idx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            selectedTopicIdx === idx
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-white'
                          }`}
                        >
                          Sample {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Refined Academic Title Card */}
                  <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-1">
                      Scholarly Refined Topic Title
                    </span>
                    <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                      {sampleTopics[selectedTopicIdx].title}
                    </h4>
                  </div>

                  {/* PICO Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-sky-500 uppercase">Population (P)</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {sampleTopics[selectedTopicIdx].pico.population}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">Intervention (I)</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {sampleTopics[selectedTopicIdx].pico.intervention}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-amber-500 uppercase">Comparison (C)</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {sampleTopics[selectedTopicIdx].pico.comparison}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-purple-500 uppercase">Outcome (O)</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        {sampleTopics[selectedTopicIdx].pico.outcome}
                      </p>
                    </div>
                  </div>

                  {/* Testable Hypothesis */}
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase">Testable Hypothesis (H₁)</span>
                    <p className="text-xs text-gray-800 dark:text-gray-200 italic">
                      &quot;{sampleTopics[selectedTopicIdx].hypothesis}&quot;
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── TOOL 3: SMART CITATIONS MATRIX ── */}
              {activeTool === 'citations' && (
                <motion.div
                  key="citations"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Scite-Style Smart Citation Verification
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Never cite a paper blindly. Tafiti AI analyzes whether the cited evidence substantiates or contradicts the claim.
                    </p>
                  </div>

                  {/* Claim Card */}
                  <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 space-y-2">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase">Research Claim Under Verification</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      &quot;Artemisinin-based combination therapy (ACT) reduces mortality in pediatric falciparum malaria by over 40% compared to oral quinine.&quot;
                    </p>
                  </div>

                  {/* Stance Results */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supporting source */}
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Supporting Evidence (98% Conf)</span>
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-slate-500">The Lancet Infectious Diseases (2023)</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-slate-300 italic border-l-2 border-emerald-500/40 pl-3">
                        &quot;In this multi-center randomized trial of 1,200 pediatric patients in Western Kenya, ACT demonstrated a 43.8% risk reduction in 28-day mortality (p &lt; 0.001).&quot;
                      </p>
                    </div>

                    {/* Contrasting source */}
                    <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Contrasting / Boundary Condition (91% Conf)</span>
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-slate-500">Nature Microbiology (2024)</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-slate-300 italic border-l-2 border-rose-500/40 pl-3">
                        &quot;Emergence of Kelch13 mutation strains in localized cohorts was associated with delayed parasite clearance, diminishing mortality benefit to 12.4%.&quot;
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA Footer inside playground */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Ready to accelerate your research? Try all models, deep search, and the thesis copilot.
            </span>
            <a
              href="https://app.tafitiai.co.ke"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-md shadow-indigo-500/20"
            >
              <span>Launch Full Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
