import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import 'katex/dist/katex.min.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tafiti AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#030305" />
        <meta name="application-name" content="Tafiti AI" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Tafiti AI",
              url: "https://tafitiai.co.ke",
              logo: "https://tafitiai.co.ke/android-chrome-512x512.png",
              email: "hello@tafitiai.co.ke",
              description: "AI-powered academic research platform for African researchers.",
              sameAs: ["https://twitter.com/tafitiai", "https://linkedin.com/company/tafitiai", "https://github.com/tafitiai"]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Tafiti AI",
              url: "https://tafitiai.co.ke",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://tafitiai.co.ke/research?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Tafiti AI",
              url: "https://tafitiai.co.ke",
              applicationCategory: "EducationalApplication",
              operatingSystem: "All",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD"
              },
              description: "AI synthesis, gap analysis, and systematic review tools purpose-built for academic researchers across Africa and beyond.",
              featureList: [
                "Literature Synthesis across 200M+ papers",
                "African Academic Research Integration (AJOL, AfricArxiv)",
                "Citation Grounding & Verification",
                "Systematic Review & PRISMA Export",
                "Gap Analysis & Research Recommendation"
              ]
            })
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans antialiased`} suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--bg-card)] focus:text-[var(--text-main)] focus:rounded-lg focus:border focus:border-[var(--border-glass)] focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
