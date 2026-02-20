"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
    {
        question: "How is Tafiti AI different from ChatGPT?",
        answer: "Unlike general chatbots, Tafiti AI is purpose-built for deep research. It accesses real-time data, cites every source, and synthesizes information from multiple documents rather than just generating text based on training data."
    },
    {
        question: "Is my research data private?",
        answer: "Absolutely. We adhere to strict enterprise security standards. Your queries and research data are encrypted in transit and at rest, and we never train our public models on your private data."
    },
    {
        question: "Can I try it for free?",
        answer: "Yes! We offer a generous free tier that gives you access to basic research capabilities. No credit card required to get started."
    },
    {
        question: "What sources does Tafiti AI access?",
        answer: "We index millions of academic papers, reputable news sources, technical documentation, and the open web to ensure you get the most comprehensive and accurate results."
    }
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-24 bg-gray-50 dark:bg-gray-900/30">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
                        Common <span className="text-purple-600 dark:text-purple-400">Questions</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Everything you need to know about getting started.
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                            >
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {faq.question}
                                </span>
                                <span className="ml-4 flex-shrink-0 text-purple-600 dark:text-purple-400">
                                    {openIndex === index ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                </span>
                            </button>
                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="px-6 pb-6 text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700/50 pt-4">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
