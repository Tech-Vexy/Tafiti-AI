'use client';

import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { ToastProvider } from '@/hooks/useToast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import EmotionCacheProvider from '@/components/EmotionCacheProvider';
import { lightTheme, darkTheme } from '@/theme';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

type ThemeMode = 'system' | 'light' | 'dark';

function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>('system');
  const [prefersDark, setPrefersDark] = React.useState(true);

  React.useEffect(() => {
    const saved = localStorage.getItem('tafiti-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setMode(saved);
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mq.matches);

    const apply = () => {
      setPrefersDark(mq.matches);
      const currentMode = (localStorage.getItem('tafiti-theme') as ThemeMode) || 'system';
      const isDark = currentMode === 'dark' || (currentMode === 'system' && mq.matches);
      const root = document.documentElement;
      root.classList.toggle('light', !isDark);
      root.classList.toggle('dark', isDark);
    };

    apply();
    mq.addEventListener('change', apply);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tafiti-theme' && e.newValue) {
        const val = e.newValue as ThemeMode;
        if (val === 'light' || val === 'dark' || val === 'system') {
          setMode(val);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  React.useEffect(() => {
    localStorage.setItem('tafiti-theme', mode);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = mode === 'dark' || (mode === 'system' && mq.matches);
    const root = document.documentElement;
    root.classList.toggle('light', !isDark);
    root.classList.toggle('dark', isDark);
  }, [mode]);

  const effectiveDark = mode === 'dark' || (mode === 'system' && prefersDark);
  const theme = effectiveDark ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    // Observe class changes on <html> to sync Clerk theme
    const observer = new MutationObserver(() => {
      setIsDark(!document.documentElement.classList.contains('light'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDark(!document.documentElement.classList.contains('light'));
    return () => observer.disconnect();
  }, []);

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{ baseTheme: isDark ? dark : undefined }}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/auth/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/auth/sign-up'}
    >
      <EmotionCacheProvider options={{ key: 'mui', prepend: true }}>
        <ThemeModeProvider>
          <TooltipProvider delayDuration={300}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeModeProvider>
      </EmotionCacheProvider>
    </ClerkProvider>
  );
}
