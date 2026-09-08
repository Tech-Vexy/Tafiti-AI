'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    rating: 5,
    quote: "Tafiti AI cut my literature review time from 3 weeks to 3 days. The smart citations feature showed me which papers actually supported vs contradicted my thesis — something I was doing manually before.",
    author: 'Dr. Amina Wanjiku',
    role: 'PhD Candidate, University of Nairobi',
    field: 'Public Health',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amina',
  },
  {
    rating: 5,
    quote: "The code sandbox is a game-changer. I ran Monte Carlo simulations for my agricultural economics thesis without installing anything. The pre-built templates saved me hours of setup.",
    author: 'James Okonkwo',
    role: 'MSc Student, Makerere University',
    field: 'Agricultural Economics',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
  },
  {
    rating: 5,
    quote: "Our research team of 8 uses the collaborative thesis editor daily. Real-time cursors, CRDT conflict resolution, and the AI writing assistant make it feel like Google Docs but for academic writing.",
    author: 'Prof. Fatima Al-Rashid',
    role: 'Research Lead, University of Cape Town',
    field: 'Computer Science',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima',
  },
  {
    rating: 5,
    quote: "The systematic review tools are incredible. PICO extraction, AI-assisted screening, and PRISMA flow diagrams — all in one place. Our Cochrane-style review is 60% faster.",
    author: 'Dr. Samuel Mensah',
    role: 'Epidemiologist, WHO AFRO',
    field: 'Epidemiology',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Samuel',
  },
  {
    rating: 5,
    quote: "I was stuck on my thesis topic until Tafiti's topic enhancement feature reframed it with proper PICO elements and generated 3 testable hypotheses I hadn't considered.",
    author: 'Grace Achieng',
    role: 'MPharm Student, UoN',
    field: 'Pharmacology',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Grace',
  },
  {
    rating: 5,
    quote: "The research timeline feature helped me visualize 50 years of CRISPR research in minutes. I found gaps in the literature that became the core of my review paper.",
    author: 'Dr. Kofi Asante',
    role: 'Postdoc, University of Ghana',
    field: 'Molecular Biology',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kofi',
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-[#030305] relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 mb-6"
          >
            <Star className="w-4 h-4" />
            <span className="text-sm font-semibold">Testimonials</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Loved by{' '}
            <span className="gradient-text">researchers</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            Join thousands of researchers across Africa who trust Tafiti AI for their work.
          </motion.p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item, index) => (
            <motion.div
              key={item.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              className="group p-8 rounded-3xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all h-full flex flex-col"
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-indigo-500/20 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 text-amber-400 mb-4">
                {[...Array(item.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6 flex-grow text-sm">
                &ldquo;{item.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 dark:bg-white/5 shrink-0">
                  <img
                    src={item.avatar}
                    alt={item.author}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{item.author}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">{item.role}</div>
                </div>
                <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-500">
                  {item.field}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
