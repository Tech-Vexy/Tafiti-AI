'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles, Building2, Zap } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    icon: Zap,
    price: '0',
    period: 'forever',
    description: 'Perfect for getting started with research',
    color: 'from-gray-500 to-gray-600',
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-200 dark:border-gray-800',
    features: [
      'Basic paper search',
      '5 AI synthesis queries/day',
      'Save up to 50 papers',
      'Basic thesis editor',
      'Community support',
    ],
    cta: 'Get Started Free',
    href: 'https://app.tafitiai.co.ke',
    popular: false,
  },
  {
    name: 'Pro',
    icon: Sparkles,
    price: '200',
    period: '/month',
    description: 'For serious researchers who need the full toolkit',
    color: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-500',
    border: 'border-indigo-500/30',
    features: [
      'Unlimited paper search',
      'Unlimited AI synthesis & agents',
      'Smart citations & citation graph',
      'Thesis editor with AI writing',
      'Code sandbox & simulations',
      'Systematic review tools',
      'Real-time collaboration',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: 'https://app.tafitiai.co.ke',
    popular: true,
  },
  {
    name: 'Institution',
    icon: Building2,
    price: 'Custom',
    period: '',
    description: 'For universities and research organizations',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-gray-200 dark:border-gray-800',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Institutional sandboxes',
      'Custom AI model fine-tuning',
      'SSO & admin dashboard',
      'API access',
      'Dedicated support & training',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@tafitiai.co.ke',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-24 md:py-32 bg-gray-50/50 dark:bg-white/[0.01] relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mb-6"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Simple Pricing</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Start free.{' '}
            <span className="gradient-text">Scale when ready.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-500 dark:text-gray-400"
          >
            No credit card required. Upgrade when you need more power.
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`pricing-card relative p-8 rounded-3xl bg-white dark:bg-white/[0.02] border ${plan.border} ${
                plan.popular ? 'ring-2 ring-indigo-500/30 shadow-xl shadow-indigo-500/10' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-8">
                <div className={`w-12 h-12 ${plan.bg} rounded-2xl flex items-center justify-center mb-4`}>
                  <plan.icon className={`w-6 h-6 ${plan.text}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8">
                {plan.price === 'Custom' ? (
                  <div className="text-4xl font-black text-gray-900 dark:text-white">Custom</div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-gray-500">KES</span>
                      <span className="text-5xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                      {plan.period && <span className="text-sm text-gray-500 font-medium">{plan.period}</span>}
                    </div>
                    {plan.price === '200' && (
                      <span className="text-[11px] font-semibold text-emerald-500 block mt-1">
                        ≈ $1.50 USD • Pay with M-Pesa, Card, or Bank
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 ${plan.text} shrink-0 mt-0.5`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.href}
                className={`block w-full text-center py-3 rounded-2xl font-bold transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
