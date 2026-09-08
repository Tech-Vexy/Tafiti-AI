'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Cpu, Sparkles, BookOpen, Layers, Shield,
  ArrowRight, Moon, Sun, DollarSign, HelpCircle, X, Terminal
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
}

export default function CommandMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const navigate = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };

  const commands: CommandItem[] = [
    {
      id: 'demo-sim',
      label: 'Test-Drive Python Simulation Studio',
      category: 'Interactive Tools',
      icon: Cpu,
      action: () => navigate('/demo'),
      shortcut: 'S',
    },
    {
      id: 'demo-topic',
      label: 'Explore AI Topic & PICO Enhancer',
      category: 'Interactive Tools',
      icon: Sparkles,
      action: () => navigate('/demo'),
      shortcut: 'P',
    },
    {
      id: 'features',
      label: 'Explore Platform Capabilities & Bento Grid',
      category: 'Navigation',
      icon: Layers,
      action: () => navigate('/features'),
    },
    {
      id: 'comparison',
      label: 'Why Tafiti AI vs Generic Chatbots',
      category: 'Navigation',
      icon: Shield,
      action: () => navigate('/comparison'),
    },
    {
      id: 'how-it-works',
      label: 'Four-Step Academic Workflow',
      category: 'Navigation',
      icon: BookOpen,
      action: () => navigate('/how-it-works'),
    },
    {
      id: 'pricing',
      label: 'View Pricing & Local Currency Calculator',
      category: 'Account & Plans',
      icon: DollarSign,
      action: () => navigate('/pricing'),
      shortcut: 'K',
    },
    {
      id: 'faq',
      label: 'Frequently Asked Questions',
      category: 'Help',
      icon: HelpCircle,
      action: () => navigate('/faq'),
    },
    {
      id: 'toggle-theme',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      category: 'Preferences',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        setIsOpen(false);
      },
      shortcut: 'T',
    },
    {
      id: 'launch-app',
      label: 'Open Tafiti AI Research Platform App',
      category: 'Application',
      icon: ArrowRight,
      action: () => {
        window.location.href = 'https://app.tafitiai.co.ke';
      },
      shortcut: '↵',
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Global Floating Trigger (bottom-right desktop shortcut indicator) */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gray-900/90 dark:bg-black/90 text-white text-xs font-semibold shadow-2xl border border-white/10 hover:border-indigo-500/40 backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
      >
        <Search className="w-3.5 h-3.5 text-indigo-400" />
        <span>Quick Launcher</span>
        <kbd className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-mono text-gray-300">
          ⌘K
        </kbd>
      </button>

      {/* Modal Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center p-4 sm:pt-28"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0d0d14] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden glass"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-white/10">
                <Search className="w-5 h-5 text-indigo-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Type a command or jump to feature..."
                  className="flex-1 bg-transparent text-sm sm:text-base text-gray-900 dark:text-white placeholder:text-gray-400 outline-none font-medium"
                />
                <kbd className="hidden sm:inline-block px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-[10px] font-mono text-gray-400">
                  ESC
                </kbd>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Commands List */}
              <div className="max-h-80 overflow-y-auto p-3 space-y-1">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">
                    No commands matching &quot;{search}&quot;
                  </div>
                ) : (
                  filtered.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left transition-all ${
                        selectedIndex === idx
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            selectedIndex === idx
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-semibold block">{item.label}</span>
                          <span
                            className={`text-[10px] uppercase tracking-wider ${
                              selectedIndex === idx ? 'text-indigo-200' : 'text-gray-400'
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                      </div>

                      {item.shortcut && (
                        <kbd
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            selectedIndex === idx
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 dark:bg-white/10 text-gray-400'
                          }`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-6 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-between text-[11px] text-gray-400">
                <span>Navigate with mouse or arrow keys</span>
                <span className="text-indigo-400 font-semibold">Tafiti AI OS</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
