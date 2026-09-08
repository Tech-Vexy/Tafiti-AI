'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Database, Users, FileText, Globe } from 'lucide-react';

function AnimatedCounter({ target, suffix = '', duration = 2 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = target / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const stats = [
  {
    icon: Database,
    value: 10,
    suffix: 'M+',
    label: 'Papers Indexed',
    description: 'Across OpenAlex, Semantic Scholar, CORE, Scopus, and more',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Users,
    value: 50,
    suffix: 'K+',
    label: 'Active Researchers',
    description: 'Across 30+ African countries and growing',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: FileText,
    value: 500,
    suffix: 'K+',
    label: 'Research Sessions',
    description: 'Deep research queries completed this year',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Globe,
    value: 30,
    suffix: '+',
    label: 'Countries',
    description: 'Researchers using Tafiti AI across Africa',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
];

export default function Stats() {
  return (
    <section className="py-24 md:py-32 bg-white dark:bg-[#030305] relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center p-6 md:p-8 rounded-3xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5"
            >
              <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <stat.icon className={`w-7 h-7 ${stat.color}`} />
              </div>
              <div className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{stat.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">{stat.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
