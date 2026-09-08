import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tafiti AI',
    short_name: 'Tafiti',
    description: 'AI synthesis, gap analysis, and systematic review tools — purpose-built for academic researchers across Africa.',
    start_url: '/',
    display: 'standalone',
    background_color: '#030305',
    theme_color: '#030305',
    orientation: 'portrait',
    categories: ['education', 'productivity', 'research'],
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    lang: 'en',
    dir: 'ltr',
    prefer_related_applications: false,
  };
}
