"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface Testimonial {
    id: string;
    rating: number;
    quote: string;
    author: string;
    role: string | null;
    avatar: string | null;
}

const mockTestimonials = [
    {
        id: "mock-1",
        rating: 5,
        quote: "Tafiti AI has completely changed how I approach my master's thesis. The depth of synthesis is unlike anything else.",
        author: "Sarah J.",
        role: "Graduate Researcher",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
    },
    {
        id: "mock-2",
        rating: 5,
        quote: "Finally, a research tool that doesn't just list links but actually answers my questions with citations.",
        author: "David Chen",
        role: "Tech Analyst",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David"
    },
    {
        id: "mock-3",
        rating: 5,
        quote: "The speed at which I can validate market trends has doubled. It's an essential tool for our strategy team.",
        author: "Elena Rodriguez",
        role: "Strategy Director",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena"
    }
];

export default function Testimonials() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>(mockTestimonials);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTestimonials = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
                const response = await fetch(`${apiUrl}/feedback/testimonials?limit=3`);

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setTestimonials(data);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch testimonials:", error);
                // Fallback to mock data is automatic since state was initialized with it
            } finally {
                setLoading(false);
            }
        };

        fetchTestimonials();
    }, []);

    return (
        <section id="testimonials" className="py-24 bg-white dark:bg-black text-center">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
                        Loved by <span className="text-blue-600 dark:text-blue-400">Researchers</span>
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Join thousands of professionals who trust Tafiti AI for their critical research needs.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {testimonials.map((item, index) => (
                        <motion.div
                            key={item.id || index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.2, duration: 0.5 }}
                            className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center hover:border-blue-500/30 transition-colors h-full"
                        >
                            <div className="flex gap-1 text-yellow-500 mb-6">
                                {[...Array(item.rating || 5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 fill-current" />
                                ))}
                            </div>
                            <p className="text-lg text-gray-700 dark:text-gray-300 italic mb-8 flex-grow">
                                "{item.quote}"
                            </p>
                            <div className="flex items-center gap-4 mt-auto">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                    <img
                                        src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.author}`}
                                        alt={item.author}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-900 dark:text-white">{item.author}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-500">{item.role || "Tafiti User"}</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
