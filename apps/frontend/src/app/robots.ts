import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://tafitiai.co.ke';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/research',
          '/privacy',
          '/terms',
          '/manifest.webmanifest',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/history',
          '/billing',
          '/billing/*',
          '/profile',
          '/_next/',
          '/admin/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/research',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/history',
          '/billing',
          '/billing/*',
          '/profile',
          '/_next/',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: [
          '/',
          '/research',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/history',
          '/billing',
          '/billing/*',
          '/profile',
          '/_next/',
        ],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'CCBot'],
        allow: [
          '/',
          '/research',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/history',
          '/billing',
          '/billing/*',
          '/profile',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

