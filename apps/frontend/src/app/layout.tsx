import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tafitiai.co.ke'),
  title: {
    default: 'Tafiti AI — Research smarter. Publish faster.',
    template: '%s | Tafiti AI',
  },
  description: 'AI synthesis, gap analysis, and systematic review tools — purpose-built for academic researchers across Africa.',
  keywords: [
    'AI research', 'academic research', 'systematic review', 'gap analysis',
    'African researchers', 'AI synthesis', 'literature review', 'thesis writing',
    'research platform', 'scientific discovery', 'knowledge synthesis',
  ],
  authors: [{ name: 'Tafiti AI' }],
  creator: 'Tafiti AI',
  publisher: 'Tafiti AI',
  category: 'Research',
  applicationName: 'Tafiti AI',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Tafiti AI',
    title: 'Tafiti AI — Research smarter. Publish faster.',
    description: 'AI-powered academic research platform for African researchers',
    url: 'https://tafitiai.co.ke',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Tafiti AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tafiti AI — Research smarter. Publish faster.',
    description: 'AI synthesis, gap analysis, and systematic review tools for academic researchers across Africa.',
    creator: '@tafitiai',
    images: ['/android-chrome-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: 'https://tafitiai.co.ke',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#030305' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
