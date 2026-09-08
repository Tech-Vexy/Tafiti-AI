'use client';

import { motion } from 'framer-motion';

const institutions = [
  { name: 'OpenAlex Global Index', category: '250M+ Papers' },
  { name: 'CORE Open Access', category: 'Global Repository Index' },
  { name: 'AfricArXiv', category: 'African Preprint Repository' },
  { name: 'African Journals Online (AJOL)', category: 'Peer-Reviewed Journals' },
  { name: 'Crossref & DOI', category: 'Metadata Authority' },
  { name: 'University of Nairobi', category: 'Institutional Partner' },
  { name: 'University of Cape Town', category: 'Institutional Partner' },
  { name: 'Makerere University', category: 'Institutional Partner' },
];

export default function LogoCloud() {
  return (
    <section className="py-16 bg-gray-50/70 dark:bg-white/[0.01] border-y border-gray-200/60 dark:border-white/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Synthesizing Ground-Truth Evidence from Premier Global &amp; Pan-African Indexes
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center justify-center">
          {institutions.map((inst, i) => (
            <motion.div
              key={inst.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/5 text-center flex flex-col items-center justify-center hover:border-indigo-500/30 transition-all group"
            >
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-indigo-400 transition-colors line-clamp-1">
                {inst.name}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                {inst.category}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
