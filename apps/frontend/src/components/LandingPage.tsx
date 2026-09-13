'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Sun, Moon } from 'lucide-react';
import ResearchPromptBox from './ResearchChatbot/ResearchPromptBox';
import useResearchStore from '@/store/useResearchStore';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/research');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    const saved = localStorage.getItem('tafiti-theme');
    const isLight = saved === 'light' || (!saved && window.matchMedia('(prefers-color-scheme: light)').matches);
    setTheme(isLight ? 'light' : 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tafiti-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'tafiti-theme', newValue: next }));
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    if (isSignedIn) {
      useResearchStore.getState().handleResearchChat(text, [], []);
      router.push('/research');
      return;
    }

    // Directs unauthenticated users to signup
    router.push('/auth/sign-up');
  };

  const handleAttachClick = () => {
    if (isSignedIn) {
      router.push('/research');
    } else {
      router.push('/auth/sign-up');
    }
  };

  return (
    <div className="h-screen w-screen max-h-screen overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8 bg-[var(--bg-main)] text-[var(--text-main)] font-sans select-none transition-colors duration-150">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <header className="w-full flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-glass)] flex items-center justify-center overflow-hidden p-1 shrink-0 shadow-sm">
            <Image
              src="/android-chrome-192x192.png"
              alt="Tafiti AI"
              width={28}
              height={28}
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <span className="font-semibold text-base sm:text-lg tracking-tight text-[var(--text-main)]">
            Tafiti AI Research Platform
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label={`Toggle to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-glass)] transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {isLoaded && isSignedIn ? (
            <Link
              href="/research"
              id="top-workspace-btn"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity"
            >
              Open Research
            </Link>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                id="top-signin-btn"
                className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/auth/sign-up"
                id="top-signup-btn"
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[var(--text-main)] text-[var(--bg-main)] hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Center Stage: Minimalist Interface with Ported Chat Input ─ */}
      <main className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center my-auto">
        <h1 className="text-2xl sm:text-4xl font-normal tracking-tight text-[var(--text-main)] text-center mb-6 sm:mb-8">
          What are you researching?
        </h1>

        {/* Ported Chat Input Area */}
        <div className="w-full">
          <ResearchPromptBox
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={false}
            uploadedFiles={[]}
            onRemoveUpload={() => {}}
            onOpenGroundingDrawer={handleAttachClick}
          />
        </div>
      </main>

      {/* ── Bottom Minimalist Footer ───────────────────────────────── */}
      <footer className="w-full shrink-0 pt-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[var(--text-dim)] gap-2">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-[var(--text-main)] transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--text-main)] transition-colors">Terms</Link>
        </div>

        <div>
          <span>© {new Date().getFullYear()} Tafiti AI Research Platform</span>
        </div>
      </footer>
    </div>
  );
}
