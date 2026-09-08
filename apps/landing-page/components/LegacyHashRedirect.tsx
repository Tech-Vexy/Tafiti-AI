'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      const validRoutes = [
        'pricing',
        'features',
        'demo',
        'comparison',
        'how-it-works',
        'faq',
        'testimonials'
      ];
      if (validRoutes.includes(hash)) {
        // Strip the hash and push to real App Router path
        router.replace(`/${hash}`);
      }
    }
  }, [router]);

  return null;
}
