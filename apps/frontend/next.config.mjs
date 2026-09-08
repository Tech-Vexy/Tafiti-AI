/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'clsx', 'tailwind-merge'],
  },
  turbopack: {},
  transpilePackages: [
    'lucide-react',
    'clsx',
    '@syncfusion/ej2-base',
    '@syncfusion/ej2-buttons',
    '@syncfusion/ej2-inputs',
    '@syncfusion/ej2-popups',
    '@syncfusion/ej2-lists',
    '@syncfusion/ej2-navigations',
    '@syncfusion/ej2-splitbuttons',
    '@syncfusion/ej2-dropdowns',
    '@syncfusion/ej2-documenteditor',
    '@syncfusion/ej2-react-documenteditor',
    '@syncfusion/ej2-data',
    '@syncfusion/ej2-compression',
    '@syncfusion/ej2-file-utils',
    '@syncfusion/ej2-svg-base',
  ],

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
