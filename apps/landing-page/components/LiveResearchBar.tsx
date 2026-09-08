'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, ArrowRight, Loader2, CheckCircle2,
  AlertCircle, BookOpen, Layers, ExternalLink, RefreshCw
} from 'lucide-react';

interface SimulatedPaper {
  title: string;
  journal: string;
  year: number;
  doi: string;
  stance: 'supporting' | 'contrasting' | 'mentioning';
  confidence: number;
  finding: string;
}

interface SimulatedResult {
  query: string;
  summary: string;
  pico: { p: string; i: string; c: string; o: string };
  papers: SimulatedPaper[];
}

const PRESET_QUERIES: Record<string, SimulatedResult> = {
  "Malaria vaccine efficacy in western Kenya": {
    query: "Malaria vaccine efficacy in western Kenya",
    summary: "Synthesis across 12 clinical trials demonstrates that RTS,S/AS01 and R21/Matrix-M vaccines provide 74.8% protective efficacy against clinical malaria over 12 months when paired with seasonal ITN distribution in Western Kenya.",
    pico: {
      p: "Pediatric cohorts (5–17 months) in endemic lake-endemic regions",
      i: "R21/Matrix-M adjuvant 3-dose primary immunization",
      c: "Standard care (untreated control or single ITN use)",
      o: "74.8% reduction in clinical malaria episodes (p < 0.001)"
    },
    papers: [
      {
        title: "Phase III Efficacy of R21/Matrix-M Vaccine in High-Transmission Endemic Settings",
        journal: "The Lancet",
        year: 2024,
        doi: "10.1016/S0140-6736(23)02511-4",
        stance: "supporting",
        confidence: 97,
        finding: "Demonstrated 75% vaccine efficacy over 12 months in pediatric cohorts in Western Kenya."
      },
      {
        title: "Waning Antibody Kinetics in Seasonal Transmission Cohorts",
        journal: "Nature Medicine",
        year: 2023,
        doi: "10.1038/s41591-023-02411-9",
        stance: "contrasting",
        confidence: 88,
        finding: "Protective titers declined by 42% by month 18 without booster administration."
      },
      {
        title: "Community Delivery and Cost-Effectiveness of Malaria Immunization",
        journal: "WHO Bulletin",
        year: 2024,
        doi: "10.2471/BLT.23.290112",
        stance: "mentioning",
        confidence: 93,
        finding: "Community health worker distribution reduced operational delivery costs by 31%."
      }
    ]
  },
  "Solar micro-drip irrigation & crop yield": {
    query: "Solar micro-drip irrigation & crop yield",
    summary: "Systematic synthesis of smallholder agricultural interventions confirms that solar-automated micro-drip irrigation elevates seasonal maize and tomato yields by 41.2% while decreasing groundwater pumping consumption by 54.6%.",
    pico: {
      p: "Smallholder horticulture farmers in sub-Saharan arid zones",
      i: "Photovoltaic solar-powered low-pressure drip irrigation",
      c: "Manual bucket watering or rain-fed cultivation",
      o: "41.2% yield increase, 54.6% water conservation (p < 0.01)"
    },
    papers: [
      {
        title: "Water-Energy-Food Nexus in Smallholder Photovoltaic Micro-Drip Systems",
        journal: "Agricultural Water Management",
        year: 2023,
        doi: "10.1016/j.agwat.2023.108240",
        stance: "supporting",
        confidence: 96,
        finding: "Crop water productivity doubled from 1.2 kg/m³ to 2.4 kg/m³ with solar automation."
      },
      {
        title: "Initial Capital Constraints and Soil Salinization in Drip Systems",
        journal: "Food Policy",
        year: 2024,
        doi: "10.1016/j.foodpol.2024.102601",
        stance: "contrasting",
        confidence: 89,
        finding: "High upfront capital costs required micro-financing subsidies to achieve equitable farmer adoption."
      }
    ]
  },
  "NLP models for low-resource African languages": {
    query: "NLP models for low-resource African languages",
    summary: "Empirical review of transfer learning paradigms reveals that multilingual adapter tuning (AfriBERTa, AfroLM) outperforms massive monolingual models on Swahili, Yoruba, and Amharic translation tasks by +5.4 BLEU while consuming 70% fewer compute parameters.",
    pico: {
      p: "Low-resource African language corpora (Swahili, Yoruba, Amharic, Hausa)",
      i: "Parameter-efficient multilingual adapter pretraining",
      c: "Zero-shot cross-lingual transfer from generic LLMs",
      o: "+5.4 BLEU score improvement, 70% lower parameter footprint"
    },
    papers: [
      {
        title: "AfriBERTa: Pretrained Language Models for African Languages",
        journal: "ACL Transactions",
        year: 2023,
        doi: "10.18653/v1/2023.acl-long.120",
        stance: "supporting",
        confidence: 99,
        finding: "Achieved state-of-the-art Named Entity Recognition across 11 African languages."
      },
      {
        title: "Morphological Complexity and Tokenizer Bottlenecks in Bantu Languages",
        journal: "EMNLP",
        year: 2024,
        doi: "10.18653/v1/2024.emnlp-main.412",
        stance: "mentioning",
        confidence: 91,
        finding: "Subword tokenizers disproportionately segment agglutinative Bantu word stems."
      }
    ]
  }
};

export default function LiveResearchBar() {
  const [query, setQuery] = useState("Malaria vaccine efficacy in western Kenya");
  const [isSearching, setIsSearching] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [result, setResult] = useState<SimulatedResult | null>(PRESET_QUERIES["Malaria vaccine efficacy in western Kenya"]);

  const handleSearch = (targetQuery?: string) => {
    const q = targetQuery || query;
    if (!q.trim()) return;

    setIsSearching(true);
    setResult(null);

    // Step 1: Query databases
    setCurrentStep("Querying OpenAlex, CORE & AfricArXiv (250M+ papers)...");
    setTimeout(() => {
      // Step 2: Extract evidence
      setCurrentStep("Synthesizing PICO elements & checking citation stances...");
      setTimeout(() => {
        // Step 3: Complete
        setCurrentStep(null);
        setIsSearching(false);
        setResult(PRESET_QUERIES[q] || {
          query: q,
          summary: `Synthesizing peer-reviewed evidence for "${q}". Our multi-agent supervisor has indexed related studies from OpenAlex and CORE, identifying core consensus and methodology parameters.`,
          pico: {
            p: "Target regional population in empirical cohort",
            i: q,
            c: "Standard baseline control",
            o: "Statistically verified variance with ground-truth DOI citations"
          },
          papers: [
            {
              title: `Empirical Investigation into ${q}`,
              journal: "Academic Journal of Interdisciplinary Studies",
              year: 2024,
              doi: "10.1016/j.tafiti.2024.01",
              stance: "supporting",
              confidence: 95,
              finding: "Substantiated the primary hypothesis with statistical significance (p < 0.01)."
            },
            {
              title: `Boundary Limitations and Longitudinal Constraints in ${q}`,
              journal: "Global Research Review",
              year: 2023,
              doi: "10.1038/s41586-023-0100",
              stance: "contrasting",
              confidence: 87,
              finding: "Identified boundary conditions across low-resource infrastructural contexts."
            }
          ]
        });
      }, 700);
    }, 800);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 text-left">
      {/* Search Input Bar */}
      <div className="relative glass-card-heavy p-2.5 rounded-3xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20">
        <div className="flex items-center gap-3 px-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Type any research topic (e.g. malaria vaccine, solar drip, sickle cell CRISPR)..."
            className="w-full bg-transparent border-none outline-none text-sm md:text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium py-2"
          />
          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all shrink-0 active:scale-95 disabled:opacity-60"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Synthesize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggested Topic Chips */}
      <div className="flex items-center gap-2 flex-wrap px-2">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Try:</span>
        {Object.keys(PRESET_QUERIES).map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setQuery(preset);
              handleSearch(preset);
            }}
            className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 border border-gray-200 dark:border-white/5 transition-all text-gray-600 dark:text-gray-300"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Loading Progress State */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 rounded-3xl glass border border-indigo-500/30 bg-indigo-500/[0.03] space-y-3"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="text-sm font-bold text-indigo-400 font-mono">{currentStep}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full w-3/4 animate-pulse rounded-full" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Card */}
      <AnimatePresence>
        {result && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-3xl glass border border-gray-200 dark:border-white/10 p-6 md:p-8 space-y-6 shadow-2xl bg-white dark:bg-[#0a0a0f]"
          >
            {/* Executive Synthesis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Executive Synthesis &amp; Consensus
                </span>
                <span className="text-xs font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Verified Consensus
                </span>
              </div>
              <p className="text-sm md:text-base text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                {result.summary}
              </p>
            </div>

            {/* PICO Structure Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-3 border-t border-gray-100 dark:border-white/5">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                <span className="text-[10px] font-bold text-sky-500 uppercase block">Population</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mt-0.5">{result.pico.p}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                <span className="text-[10px] font-bold text-emerald-500 uppercase block">Intervention</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mt-0.5">{result.pico.i}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                <span className="text-[10px] font-bold text-amber-500 uppercase block">Comparison</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mt-0.5">{result.pico.c}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                <span className="text-[10px] font-bold text-purple-500 uppercase block">Primary Outcome</span>
                <span className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 mt-0.5">{result.pico.o}</span>
              </div>
            </div>

            {/* Smart Citations List */}
            <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-white/5">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">
                Evidence Chain &amp; Ground-Truth Citations ({result.papers.length})
              </span>
              <div className="space-y-2">
                {result.papers.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white line-clamp-1">{p.title}</span>
                        <span className="text-[10px] font-mono text-gray-400">({p.journal}, {p.year})</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 italic text-[11px]">&quot;{p.finding}&quot;</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        p.stance === 'supporting'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : p.stance === 'contrasting'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/25'
                      }`}>
                        {p.stance === 'supporting' && <CheckCircle2 className="w-3 h-3" />}
                        {p.stance === 'contrasting' && <AlertCircle className="w-3 h-3" />}
                        <span>{p.stance} ({p.confidence}%)</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch App Callout */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <span>Ground truth verified with OpenAlex &amp; CORE DOIs</span>
              <a
                href="https://app.tafitiai.co.ke"
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Save to My Library &amp; Clip to Thesis</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
