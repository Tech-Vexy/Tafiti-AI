import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions governing your use of Tafiti AI.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service | Tafiti AI',
    description: 'The terms and conditions governing your use of Tafiti AI.',
    url: 'https://tafitiai.co.ke/terms',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | Tafiti AI',
    description: 'The terms and conditions governing your use of Tafiti AI.',
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] py-16 px-4 sm:px-6 lg:px-8">
      <main className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-3 border-b border-[var(--border-glass)] pb-8">
          <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
            Tafiti AI → Legal & Terms
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--text-main)]">
            Terms of Service
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Effective Date: September 13, 2026 • Last updated: September 2026
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">1. Acceptance of Terms</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            By creating an account, browsing the website, or accessing the Tafiti AI research platform at <a href="https://tafitiai.co.ke" className="text-sky-400 underline">https://tafitiai.co.ke</a> or via our APIs, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">2. Description of Academic Services</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            Tafiti AI provides scholarly literature discovery, citation grounding, gap analysis, systematic review generation, and collaborative research tools. The platform connects academic researchers with open-access indexes including OpenAlex, arXiv, Crossref, AJOL, and AfricArxiv.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">3. Academic Integrity & Scholar Responsibility</h2>
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm sm:text-base leading-relaxed space-y-2">
            <p className="font-semibold">Important Notice on Academic Standards:</p>
            <p>
              Tafiti AI is an assistive research synthesizer, not a substitute for scholarly peer review or independent verification. Researchers and students are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>Independently reviewing and verifying all primary source citations before publication.</li>
              <li>Ensuring compliance with your institution&rsquo;s academic honesty codes, thesis guidelines, and publisher policies.</li>
              <li>Transparently disclosing AI-assisted literature synthesis where required by journals or academic committees.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">4. Intellectual Property & User Ownership</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            You retain full intellectual property rights to your research queries, uploaded preprints, notes, and synthesized documents. Tafiti AI claims no ownership over your original scholarship. You grant Tafiti AI only the limited, temporary license required to process, display, and format your research within your secure account session.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">5. Subscriptions, Payments & Billing</h2>
          <div className="space-y-3 text-[var(--text-dim)] text-sm sm:text-base">
            <p><strong>A. Pricing & Tiers:</strong> Paid subscriptions (including Tafiti Pro) provide higher synthesis limits, priority model access, and deep gap analysis. Rates and billing intervals are detailed on the Billing page.</p>
            <p><strong>B. Payment Gateways:</strong> Payments are processed via Paystack. By subscribing, you authorize recurring charges for your selected billing cycle until cancelled.</p>
            <p><strong>C. Cancellation & Refunds:</strong> You may cancel your subscription anytime via the dashboard. Your access will remain active through the conclusion of the paid billing period.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">6. Acceptable Use Policy</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            You agree not to use Tafiti AI to:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-dim)] text-sm sm:text-base">
            <li>Engage in automated scraping or denial-of-service attempts against our infrastructure.</li>
            <li>Upload malicious scripts, viruses, or unauthorized proprietary files.</li>
            <li>Violate copyright, patent, or intellectual property rights of third-party authors or publishers.</li>
            <li>Generate dishonest, defamatory, or fraudulent research claims.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">7. Disclaimers & Limitation of Liability</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            Tafiti AI is provided &ldquo;as is&rdquo; without warranties of any kind. While we prioritize citation grounding and factual accuracy against verified academic databases, we do not guarantee that AI responses are error-free. In no event shall Tafiti AI be liable for any indirect, incidental, or consequential damages resulting from your use of the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">8. Governing Law & Contact</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            These Terms shall be governed by and construed in accordance with the laws of the Republic of Kenya. For inquiries or questions regarding these terms, please contact us at:
          </p>
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-sm">
            <p className="font-semibold text-[var(--text-main)]">Tafiti AI Legal Team</p>
            <p className="text-[var(--text-muted)]">Email: <a href="mailto:support@tafitiai.co.ke" className="text-sky-400">support@tafitiai.co.ke</a></p>
            <p className="text-[var(--text-muted)]">Website: <a href="https://tafitiai.co.ke" className="text-sky-400">https://tafitiai.co.ke</a></p>
          </div>
        </section>

        <footer className="border-t border-[var(--border-glass)] pt-8 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/" className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
            ← Return to Tafiti AI Homepage
          </Link>
          <Link href="/privacy" className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
            View Privacy Policy →
          </Link>
        </footer>
      </main>
    </div>
  );
}
