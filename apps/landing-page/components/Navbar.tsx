"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { useTheme } from "next-themes";

const NAV_ITEMS = [
    { label: 'Interactive Demo', href: '/demo' },
    { label: 'Capabilities', href: '/features' },
    { label: 'Why Tafiti', href: '/comparison' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <nav
            className={clsx(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                scrolled
                    ? "bg-white/90 dark:bg-[#030305]/90 backdrop-blur-md border-gray-200 dark:border-white/10 py-3.5 shadow-sm"
                    : "bg-transparent border-transparent py-5"
            )}
        >
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex items-center justify-between">
                    {/* Brand Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                            <Image
                                src="/logo.png"
                                alt="Tafiti AI Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                            Tafiti<span className="font-light">AI</span>
                        </span>
                    </Link>

                    {/* Desktop App Router Navigation Links */}
                    <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-full bg-gray-100/70 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 backdrop-blur-md">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={clsx(
                                        "px-4 py-1.5 rounded-full text-xs font-semibold transition-all relative",
                                        isActive
                                            ? "text-white bg-indigo-600 shadow-md shadow-indigo-600/25"
                                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right side actions */}
                    <div className="hidden md:flex items-center gap-3">
                        {/* Dark / Light Mode Toggle */}
                        {mounted && (
                            <button
                                onClick={toggleTheme}
                                className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shadow-sm"
                                aria-label="Toggle theme"
                                title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                            >
                                {resolvedTheme === "dark" ? (
                                    <Sun className="w-4 h-4 text-amber-400" />
                                ) : (
                                    <Moon className="w-4 h-4 text-indigo-600" />
                                )}
                            </button>
                        )}

                        <a
                            href="https://app.tafitiai.co.ke/login"
                            className="px-5 py-2 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-md"
                        >
                            Sign In
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="lg:hidden p-2 text-gray-600 dark:text-gray-300"
                        onClick={toggleMenu}
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="lg:hidden bg-white dark:bg-[#060609] border-t border-gray-200 dark:border-white/10 overflow-hidden"
                    >
                        <div className="container mx-auto px-4 py-6 flex flex-col gap-3">
                            {NAV_ITEMS.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={clsx(
                                            "px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between",
                                            isActive
                                                ? "bg-indigo-600 text-white"
                                                : "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                                        )}
                                    >
                                        <span>{item.label}</span>
                                        {isActive && <span className="text-xs text-indigo-200 font-mono">Active</span>}
                                    </Link>
                                );
                            })}
                            <div className="h-px bg-gray-200 dark:bg-white/10 my-2" />

                            {mounted && (
                                <button
                                    onClick={toggleTheme}
                                    className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                                >
                                    <span>Theme</span>
                                    <div className="flex items-center gap-2 text-xs font-mono text-indigo-500">
                                        {resolvedTheme === 'dark' ? (
                                            <>
                                                <Sun className="w-4 h-4 text-amber-400" />
                                                <span>Dark Mode</span>
                                            </>
                                        ) : (
                                            <>
                                                <Moon className="w-4 h-4 text-indigo-600" />
                                                <span>Light Mode</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            )}

                            <a
                                href="https://app.tafitiai.co.ke/login"
                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-center text-sm shadow-md"
                            >
                                Sign In to Research Platform
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
