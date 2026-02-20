export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-black selection:bg-purple-500/30 pt-24 pb-20 px-4">
            <div className="container mx-auto max-w-4xl">
                <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Privacy Policy</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

                <div className="prose dark:prose-invert max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">1. Introduction</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Tafiti AI ("us", "we", or "our") operates the Tafiti AI application (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">2. Information Collection and Use</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            We collect several different types of information for various purposes to provide and improve our Service to you.
                        </p>
                        <ul className="list-disc pl-6 mt-2 text-gray-600 dark:text-gray-300 space-y-2">
                            <li><strong>Personal Data:</strong> Email address, First name and last name, Cookies and Usage Data.</li>
                            <li><strong>Usage Data:</strong> Information on how the Service is accessed and used.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">3. Use of Data</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Tafiti AI uses the collected data for various purposes:
                        </p>
                        <ul className="list-disc pl-6 mt-2 text-gray-600 dark:text-gray-300 space-y-2">
                            <li>To provide and maintain the Service</li>
                            <li>To notify you about changes to our Service</li>
                            <li>To allow you to participate in interactive features of our Service when you choose to do so</li>
                            <li>To provide customer care and support</li>
                            <li>To provide analysis or valuable information so that we can improve the Service</li>
                            <li>To monitor the usage of the Service</li>
                            <li>To detect, prevent and address technical issues</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">4. Transfer of Data</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Your information, including Personal Data, may be transferred to — and maintained on — computers located outside of your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">5. Security of Data</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">6. Service Providers</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            We may employ third party companies and individuals to facilitate our Service ("Service Providers"), to provide the Service on our behalf, to perform Service-related services or to assist us in analyzing how our Service is used.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">7. Changes to This Privacy Policy</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">8. Contact Us</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            If you have any questions about this Privacy Policy, please contact us.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}
