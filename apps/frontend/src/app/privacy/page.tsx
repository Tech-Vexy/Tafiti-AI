import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Tafiti AI collects, uses, and protects your personal and research data.',
};

export default function PrivacyPage() {
  const sections = [
    '1. Information We Collect',
    '2. How We Use Your Information',
    '3. Sharing and Disclosure',
    '4. Data Security',
    '5. Your Rights and Choices',
    '6. Contact Us',
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-xs uppercase tracking-wider text-sky-400">
        Tafiti AI → Legal
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
        Privacy Policy
      </h1>
      <p className="text-xs text-slate-500 mt-2">
        Last updated: September 2026
      </p>

      {sections.map((heading) => (
        <section key={heading}>
          <h2 className="text-lg font-semibold text-slate-200 mt-8 mb-3">
            {heading}
          </h2>
          <p className="text-slate-500">
            This section is being finalized. For a current copy of this policy or questions, contact privacy@tafitiai.co.ke or support@tafitiai.co.ke.
          </p>
        </section>
      ))}

      <div className="border-t border-slate-800 mt-12 pt-8">
        <p className="text-sm text-slate-400">
          Questions about our legal policies?<br />
          <Link
            href="/"
            className="text-sky-400 hover:text-sky-300 text-sm font-medium"
          >
            Return to the Tafiti AI homepage →
          </Link>
        </p>
      </div>
    </main>
  );
}
