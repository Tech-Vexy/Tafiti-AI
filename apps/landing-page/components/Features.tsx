'use client';

import { motion } from 'framer-motion';
import { Search, Brain, Zap, Globe, Shield, Activity } from 'lucide-react';

const features = [
    {
        icon: Search,
        title: "Deep Search",
        description: "Access millions of sources instantly with our advanced semantic search engine."
    },
    {
        icon: Brain,
        title: "AI Synthesis",
        description: "Get comprehensive summaries and insights synthesized from multiple documents."
    },
    {
        icon: Zap,
        title: "Instant Answers",
        description: "Ask questions and get precise, citation-backed answers in seconds."
    },
    {
        icon: Globe,
        title: "Global Coverage",
        description: "Research across languages and regions with real-time translation and localized context."
    },
    {
        icon: Shield,
        title: "Enterprise Security",
        description: "Your data is protected with enterprise-grade encryption and privacy controls."
    },
    {
        icon: Activity,
        title: "Live Updates",
        description: "Track topics and get notified when new relevant information is published."
    }
];

export default function Features() {
    return (
        <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900/50">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
                        Everything you need to <span className="text-purple-600 dark:text-purple-400">know faster</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Powering the next generation of knowledge workers with AI tools designed for depth and accuracy.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className="p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow shadow-sm"
                        >
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
                                <feature.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
