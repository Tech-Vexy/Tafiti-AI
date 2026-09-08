'use client';

import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { ToastProvider } from '@/hooks/useToast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '@/theme';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const SYNFUSION_KEY = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;

if (typeof window !== 'undefined' && SYNFUSION_KEY) {
  import('@syncfusion/ej2-base').then(({ registerLicense }) => {
    registerLicense(SYNFUSION_KEY);
  });
}

function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    const saved = localStorage.getItem('tafiti-theme');
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
      document.documentElement.classList.toggle('light', saved === 'light');
    } else {
      localStorage.setItem('tafiti-theme', 'light');
      document.documentElement.classList.add('light');
    }
  }, []);

  const theme = mode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{ baseTheme: dark }}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/auth/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/auth/sign-up'}
    >
      <ThemeModeProvider>
        <TooltipProvider delayDuration={300}>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </ThemeModeProvider>
    </ClerkProvider>
  );
}
