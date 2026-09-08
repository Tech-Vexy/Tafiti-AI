import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/auth/',
          '/api/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/auth/',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://tafitiai.co.ke/sitemap.xml',
    host: 'https://tafitiai.co.ke',
  };
}
