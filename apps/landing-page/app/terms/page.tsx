export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-black selection:bg-purple-500/30 pt-24 pb-20 px-4">
            <div className="container mx-auto max-w-4xl">
                <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Terms of Service</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

                <div className="prose dark:prose-invert max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            By accessing and using Tafiti AI, you accept and agree to be bound by the terms and provision of this agreement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">2. Description of Service</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Tafiti AI provides an AI-powered research assistant platform ("the Service"). You are responsible for obtaining access to the Service and that access may involve third party fees (such as Internet service provider or airtime charges).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">3. User Conduct</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            You agree to use the Service only for lawful purposes. You are prohibited from posting on or transmitting through the Service any material that violates or infringes in any way upon the rights of others, or that is unlawful, threatening, abusive, defamatory, invasive of privacy or publicity rights.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">4. Intellectual Property</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            The Service and its original content, features, and functionality are and will remain the exclusive property of Tafiti AI and its licensors. The Service is protected by copyright, trademark, and other laws.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">5. Termination</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">6. Limitation of Liability</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            In no event shall Tafiti AI, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">7. Changes to Terms</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">8. Contact Us</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            If you have any questions about these Terms, please contact us.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
