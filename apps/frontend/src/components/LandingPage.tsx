'use client';

import React from 'react';
import Image from 'next/image';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import {
  Sparkles, ArrowRight, FlaskConical, BookOpen, Clock,
  Check, ChevronDown, Quote, Shield, Zap, Globe2, Languages,
  GraduationCap, Building2, Users, BrainCircuit, FileSearch,
  Network, PenTool, Menu, X, Github, Twitter, Linkedin,
  Mail, MessageSquare
} from 'lucide-react';

const FEATURE_COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
  fuchsia: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', text: 'text-fuchsia-400' },
};

export default function LandingPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-main)] relative overflow-hidden flex flex-col">
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none animate-breathe" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/8 blur-[140px] rounded-full pointer-events-none animate-breathe" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-violet-600/6 blur-[100px] rounded-full pointer-events-none animate-breathe" style={{ animationDelay: '0.75s' }} />

      <header className="relative z-30 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-3">
          <Image src="/android-chrome-192x192.png" alt="Tafiti AI" width={32} height={32} className="rounded-xl" />
          <span className="font-black text-lg tracking-tight text-white">Tafiti AI</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {['Features', 'How it works', 'Pricing', 'FAQ'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
              {item}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <SignInButton mode="modal">
            <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-semibold hover:bg-white/10 transition-all">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-sm text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all" style={{ boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)' }}>
              Get started
            </button>
          </SignUpButton>
        </div>

        <button className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="relative z-40 md:hidden mx-6 mb-6 p-4 rounded-2xl bg-[var(--bg-glass-heavy)] border border-white/5 backdrop-blur-3xl animate-slide-down">
          <nav className="flex flex-col gap-1 mb-4">
            {['Features', 'How it works', 'Pricing', 'FAQ'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="px-4 py-3 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {item}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
            <SignInButton mode="modal">
              <button className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-semibold hover:bg-white/10 transition-all">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="w-full px-5 py-3 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-sm text-white font-bold transition-all" style={{ boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)' }}>
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20 relative z-10">
        <section className="w-full max-w-5xl mx-auto text-center mb-24 sm:mb-32">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            Built for African researchers
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05] max-w-4xl mx-auto animate-reveal">
            Research smarter.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400">Publish faster.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-reveal" style={{ animationDelay: '0.1s' }}>
            AI synthesis, gap analysis, and systematic review tools — purpose-built for academic researchers across Africa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12 animate-reveal" style={{ animationDelay: '0.2s' }}>
            <SignUpButton mode="modal">
              <button className="px-10 py-4 text-base font-black flex items-center justify-center gap-2 group rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98] transition-all" style={{ boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35)' }}>
                Start free trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-base">
                Watch demo
              </button>
            </SignInButton>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs text-slate-500 font-medium animate-reveal" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              7-day free trial
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Cancel anytime
            </div>
          </div>
        </section>

        <section id="trusted-by" className="w-full max-w-5xl mx-auto mb-24 sm:mb-32 animate-reveal" style={{ animationDelay: '0.4s' }}>
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-600 mb-8">
            Trusted by researchers across leading institutions
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center opacity-60">
            {[
              { name: 'University of Nairobi', icon: GraduationCap },
              { name: 'Makerere University', icon: Building2 },
              { name: 'UCT Research', icon: Users },
              { name: 'Pan-African Univ.', icon: GraduationCap },
            ].map(({ name, icon: Icon }) => (
              <div key={name} className="flex flex-col items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
                <span className="text-[11px] font-bold text-slate-500 tracking-tight text-center">{name}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="w-full max-w-6xl mx-auto mb-24 sm:mb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Zap className="w-3.5 h-3.5" />
              Core capabilities
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              Everything you need to publish
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              From literature search to final thesis — a complete AI-powered research workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Sparkles, color: 'indigo', title: 'AI Synthesis', desc: 'Multi-paper synthesis across 13+ African and global languages. Get coherent, cited summaries in seconds.', tag: 'Featured' },
              { icon: FlaskConical, color: 'violet', title: 'Gap Analysis', desc: 'Automatically identify research gaps, contradictions, and future directions in any field.', tag: 'Popular' },
              { icon: BookOpen, color: 'emerald', title: 'Systematic Review', desc: 'PICO framing, screening criteria, PRISMA flow diagrams — conduct reviews rigorously.', tag: '' },
              { icon: Clock, color: 'amber', title: 'Research Timeline', desc: 'Trace field evolution, milestones, paradigm shifts, and landmark papers chronologically.', tag: '' },
              { icon: BrainCircuit, color: 'rose', title: 'Research Chat', desc: 'Ask questions of your library. Get grounded, cited answers with source links.', tag: 'New' },
              { icon: FileSearch, color: 'sky', title: 'Discovery Feed', desc: 'Personalized paper recommendations tuned to your research preferences.', tag: '' },
              { icon: Network, color: 'fuchsia', title: 'Citation Graph', desc: 'Visualize citation networks, trace intellectual lineage, find seminal works.', tag: '' },
              { icon: PenTool, color: 'indigo', title: 'Thesis Editor', desc: 'Structured writing with AI-assisted outlining, editing, and citation formatting.', tag: 'Beta' },
              { icon: Languages, color: 'emerald', title: '13+ Languages', desc: 'Search, synthesize, and export in Kiswahili, Amharic, Yoruba, Hausa, and more.', tag: '' },
            ].map(({ icon: Icon, color, title, desc, tag }, i) => {
              const c = FEATURE_COLOR_MAP[color] || FEATURE_COLOR_MAP.indigo;
              return (
                <div key={title} className={`glass-card-interactive p-6 sm:p-7 text-left space-y-4 stagger-${Math.min(i + 1, 6)}`}>
                  <div className="flex items-start justify-between">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${c.bg} border ${c.border}`}>
                      <Icon className={`w-5 h-5 ${c.text}`} />
                    </div>
                    {tag && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
                        {tag}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-white text-base tracking-tight">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="w-full max-w-5xl mx-auto mb-24 sm:mb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <WorkflowIcon />
              Workflow
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              From question to paper in 3 steps
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              A focused, structured workflow that keeps your research moving.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Search & collect',
                desc: 'Search across 200M+ papers, upload your own PDFs, or import from Zotero. Build a focused library.',
                color: FEATURE_COLOR_MAP.indigo,
              },
              {
                step: '02',
                title: 'Synthesize & analyze',
                desc: 'Select papers and AI synthesizes findings, maps the literature, and reveals critical gaps.',
                color: FEATURE_COLOR_MAP.violet,
              },
              {
                step: '03',
                title: 'Write & publish',
                desc: 'Export clean citations, structured outlines, and formatted manuscripts. Ready to submit.',
                color: FEATURE_COLOR_MAP.emerald,
              },
            ].map(({ step, title, desc, color }, idx) => (
              <div key={step} className="relative">
                <div className="glass-card p-7 sm:p-8 text-left space-y-4 h-full">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl font-black text-lg ${color.bg} ${color.text} border ${color.border}`}>
                    {step}
                  </div>
                  <h3 className="font-black text-white text-xl tracking-tight">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
                {idx < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-[2px] bg-gradient-to-r from-white/10 to-transparent -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="testimonials" className="w-full max-w-6xl mx-auto mb-24 sm:mb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Quote className="w-3.5 h-3.5" />
              Testimonials
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              Researchers love Tafiti
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Join thousands of researchers accelerating their work with AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: 'Tafiti cut my literature review time from 3 weeks to 3 days. The gap analysis surfaced questions I hadn\'t even considered.',
                name: 'Dr. Amina K.',
                role: 'PhD Candidate, UoN',
                color: FEATURE_COLOR_MAP.indigo,
              },
              {
                quote: 'The multi-language support is a game changer. I can synthesize French and English papers seamlessly — no more manual translation.',
                name: 'Prof. Jean-Paul M.',
                role: 'Researcher, UCAD Dakar',
                color: FEATURE_COLOR_MAP.emerald,
              },
              {
                quote: 'My thesis advisor asked what tool I used — the structure and citations were cleaner than any paper I\'d submitted before.',
                name: 'Chidi O.',
                role: 'MSc Student, Covenant',
                color: FEATURE_COLOR_MAP.violet,
              },
            ].map(({ quote, name, role, color }, i) => (
              <figure key={name} className={`glass-card p-7 text-left space-y-6 stagger-${i + 1}`}>
                <Quote className={`w-7 h-7 ${color.text} opacity-70`} />
                <blockquote className="text-sm text-slate-300 leading-relaxed">
                  &ldquo;{quote}&rdquo;
                </blockquote>
                <figcaption className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <div className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center ${color.bg} ${color.text} border ${color.border}`}>
                    {name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white tracking-tight">{name}</div>
                    <div className="text-xs text-slate-500 font-medium">{role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="w-full max-w-5xl mx-auto mb-24 sm:mb-32">
          <div className="grid grid-cols-3 gap-6 sm:gap-10 text-center glass-card-heavy rounded-3xl p-8 sm:p-12">
            {[
              { value: '10K+', label: 'Active researchers' },
              { value: '50K+', label: 'Papers analyzed' },
              { value: '30+', label: 'Partner institutions' },
            ].map(({ value, label }, i) => (
              <div key={label} className={`space-y-2 stagger-${i + 1}`}>
                <div className="text-3xl sm:text-5xl font-black text-white tracking-tight">{value}</div>
                <div className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="w-full max-w-5xl mx-auto mb-24 sm:mb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Shield className="w-3.5 h-3.5" />
              Simple pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              One plan. All features.
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              No tiers. No surprises. Start free, upgrade when you're ready.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="glass-card p-7 sm:p-8 text-left space-y-6">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Free trial</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white tracking-tight">$0</span>
                  <span className="text-sm text-slate-500 font-medium">/ 7 days</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Full access to every feature. No credit card needed.
              </p>
              <ul className="space-y-3 pt-2">
                {['Unlimited searches', 'Up to 50 papers per synthesis', 'Gap analysis & timelines', '13+ languages', 'Thesis editor'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <SignUpButton mode="modal">
                <button className="w-full px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-sm">
                  Start free trial
                </button>
              </SignUpButton>
            </div>

            <div className="glass-card p-7 sm:p-8 text-left space-y-6 relative overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.3), 0 20px 60px rgba(99, 102, 241, 0.1)' }}>
              <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                Most popular
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Pro</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white tracking-tight">KSh 200</span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Everything in trial, unlimited. For researchers who publish.
              </p>
              <ul className="space-y-3 pt-2">
                {['Everything in Free', 'Unlimited papers per synthesis', 'PDF upload & OCR', 'Priority AI models', 'Export citations & manuscripts', 'Email support'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <SignUpButton mode="modal">
                <button className="w-full px-6 py-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white font-bold hover:scale-[1.01] active:scale-[0.99] transition-all text-sm" style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)' }}>
                  Upgrade to Pro
                </button>
              </SignUpButton>
            </div>
          </div>
        </section>

        <section id="faq" className="w-full max-w-3xl mx-auto mb-24 sm:mb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold uppercase tracking-wider mb-4">
              <MessageSquare className="w-3.5 h-3.5" />
              FAQ
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              Questions, answered
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'How is Tafiti different from ChatGPT for research?',
                a: 'Unlike general-purpose LLMs, Tafiti is built specifically for academic research: it searches real paper databases, synthesizes across dozens of papers simultaneously, surfaces research gaps, outputs properly formatted citations, and supports 13+ languages relevant to African researchers.',
              },
              {
                q: 'Which languages do you support?',
                a: 'English, Kiswahili, Français, العربية, Español, Português, हिन्दी, Deutsch, 中文, Amharic, Yoruba, Hausa, and Zulu — with more being added based on researcher demand.',
              },
              {
                q: 'Can I upload my own papers?',
                a: 'Yes — upload PDFs via the Pro plan. Tafiti parses, indexes, and incorporates them into your synthesis results alongside publicly available literature.',
              },
              {
                q: 'Is my data private?',
                a: 'Absolutely. Your library, notes, and queries are never used to train shared models. We are SOC 2-aligned and follow strict Kenyan & EU data protection regulations.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel from your billing dashboard. You\'ll keep access through the end of your paid period. No contracts, no exit fees.',
              },
              {
                q: 'Do you offer institutional licenses?',
                a: 'Yes — volume pricing, SSO, and admin dashboards for departments and universities. Contact partnerships@tafitiai.co.ke.',
              },
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm sm:text-base font-bold text-white tracking-tight pr-4">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <p className="px-5 sm:px-6 pb-6 text-sm text-slate-400 leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="w-full max-w-4xl mx-auto mb-24 sm:mb-32">
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-14 text-center" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 0%, rgba(99,102,241,0.15), transparent 40%), radial-gradient(circle at 80% 100%, rgba(16,185,129,0.1), transparent 40%)' }} />
            <div className="relative z-10">
              <Globe2 className="w-10 h-10 text-indigo-400 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4 max-w-2xl mx-auto">
                Start your next breakthrough today
              </h2>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
                Join 10,000+ researchers across Africa who publish faster with Tafiti AI.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <SignUpButton mode="modal">
                  <button className="px-10 py-4 text-base font-black flex items-center justify-center gap-2 group rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white hover:scale-[1.02] active:scale-[0.98] transition-all" style={{ boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)' }}>
                    Start your 7-day free trial
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </SignUpButton>
                <a href="mailto:hello@tafitiai.co.ke" className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-base inline-flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact sales
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-12 sm:py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 sm:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <Image src="/android-chrome-192x192.png" alt="Tafiti AI" width={32} height={32} className="rounded-xl" />
                <span className="font-black text-lg tracking-tight text-white">Tafiti AI</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                AI-powered research tools purpose-built for academic researchers across Africa.
              </p>
              <div className="flex items-center gap-2 pt-2">
                {[
                  { icon: Twitter, href: 'https://twitter.com/tafitiai', label: 'Twitter' },
                  { icon: Linkedin, href: 'https://linkedin.com/company/tafitiai', label: 'LinkedIn' },
                  { icon: Github, href: 'https://github.com/tafitiai', label: 'GitHub' },
                  { icon: Mail, href: 'mailto:hello@tafitiai.co.ke', label: 'Email' },
                ].map(({ icon: Icon, href, label }) => (
                  <a key={label} href={href} aria-label={label} className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'Changelog', 'Roadmap'],
              },
              {
                title: 'Resources',
                links: ['Documentation', 'Guides', 'API reference', 'Support'],
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Careers', 'Privacy', 'Terms'],
              },
            ].map((group) => (
              <div key={group.title} className="space-y-4">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{group.title}</h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-slate-400 hover:text-white font-medium transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600 font-medium">
              © {new Date().getFullYear()} Tafiti AI Ltd. All rights reserved. Nairobi, Kenya.
            </p>
            <div className="flex items-center gap-6 text-xs text-slate-600 font-medium">
              <a href="#" className="hover:text-slate-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function WorkflowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M10 6h4" />
      <path d="M17.5 10v4" />
      <path d="M10 18h4" />
      <path d="M6.5 10v4" />
    </svg>
  );
}
