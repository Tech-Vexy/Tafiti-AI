import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Tafiti AI collects, uses, and protects your personal and research data.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | Tafiti AI',
    description: 'How Tafiti AI collects, uses, and protects your personal and research data.',
    url: 'https://tafitiai.co.ke/privacy',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Tafiti AI',
    description: 'How Tafiti AI collects, uses, and protects your personal and research data.',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] py-16 px-4 sm:px-6 lg:px-8">
      <main className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-3 border-b border-[var(--border-glass)] pb-8">
          <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
            Tafiti AI → Legal & Privacy
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--text-main)]">
            Privacy Policy
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Effective Date: September 13, 2026 • Last updated: September 2026
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">1. Introduction & Scope</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            Tafiti AI (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an academic research platform dedicated to empowering scholars, scientists, and students across Africa and globally. We respect your confidentiality and are committed to protecting the privacy of your research inquiries, intellectual property, and personal data.
          </p>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            This Privacy Policy explains how we collect, store, process, and safeguard information when you use the Tafiti AI web application at <a href="https://tafitiai.co.ke" className="text-sky-400 underline">https://tafitiai.co.ke</a>, our APIs, and associated services.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">2. Information We Collect</h2>
          <div className="space-y-3 text-[var(--text-dim)] text-sm sm:text-base">
            <p><strong>A. Account & Profile Data:</strong> When you register via Clerk, we collect your name, email address, avatar image, and researcher field preferences (such as Medicine, Agriculture, Computer Science, or Law).</p>
            <p><strong>B. Research Inquiries & Prompts:</strong> Research questions, systematic review criteria, synthesis parameters, and search filters submitted to our synthesis engines.</p>
            <p><strong>C. Uploaded Documents:</strong> PDF manuscripts, theses, and reference lists uploaded for literature grounding or citation extraction.</p>
            <p><strong>D. Transaction & Subscription Data:</strong> Payment verification tokens and billing status processed securely via Paystack. We do not store full credit card numbers or banking secrets on our servers.</p>
            <p><strong>E. Telemetry & Analytics:</strong> Anonymized usage statistics, browser type, device identifiers, and response latencies to ensure platform stability and performance optimization.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">3. Zero Model Training on Private Research Data</h2>
          <div className="p-6 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-sm sm:text-base leading-relaxed">
            <strong>Our Academic Confidentiality Commitment:</strong> Tafiti AI does NOT use your private research queries, uploaded pre-publication manuscripts, or proprietary literature syntheses to train public foundational AI models. Your uploaded work remains your exclusive intellectual property.
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">4. How We Use Information</h2>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-dim)] text-sm sm:text-base">
            <li>Synthesize academic literature and cross-reference claims against 200M+ peer-reviewed papers.</li>
            <li>Connect research inquiries to African open-access repositories (including AJOL and AfricArxiv) and global indexing databases (OpenAlex, arXiv, Crossref).</li>
            <li>Maintain your research history, saved libraries, and exportable citation graphs.</li>
            <li>Manage account access, subscription tiers, and billing notifications.</li>
            <li>Prevent abuse, enforce rate limits, and maintain system security.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">5. Data Retention & Security Standards</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            All data in transit is protected using modern Transport Layer Security (TLS 1.3). Data at rest is encrypted using industry-standard AES-256 encryption. Uploaded research materials and session histories are strictly segregated by tenant user IDs. You may export or permanently delete your chat sessions and uploaded files at any time via the dashboard.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">6. Your Rights & Data Choices</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            In compliance with applicable data protection regulations, including the Kenya Data Protection Act 2019 and the General Data Protection Regulation (GDPR), you possess the right to:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-dim)] text-sm sm:text-base">
            <li>Access and download all stored research records and personal details.</li>
            <li>Request immediate deletion of your account and associated session histories.</li>
            <li>Revoke consent for non-essential communications or marketing notifications.</li>
            <li>Request correction of inaccurate personal profile data.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">7. Contact & Privacy Inquiries</h2>
          <p className="text-[var(--text-dim)] leading-relaxed text-sm sm:text-base">
            For questions, data access requests, or compliance inquiries, please contact our Data Protection team at:
          </p>
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-sm">
            <p className="font-semibold text-[var(--text-main)]">Tafiti AI Data Protection Office</p>
            <p className="text-[var(--text-muted)]">Email: <a href="mailto:privacy@tafitiai.co.ke" className="text-sky-400">privacy@tafitiai.co.ke</a></p>
            <p className="text-[var(--text-muted)]">Support: <a href="mailto:hello@tafitiai.co.ke" className="text-sky-400">hello@tafitiai.co.ke</a></p>
          </div>
        </section>

        <footer className="border-t border-[var(--border-glass)] pt-8 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <Link href="/" className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
            ← Return to Tafiti AI Homepage
          </Link>
          <Link href="/terms" className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
            View Terms of Service →
          </Link>
        </footer>
      </main>
    </div>
  );
}
