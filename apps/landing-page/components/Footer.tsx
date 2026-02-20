import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter, Linkedin } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 py-12">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0 flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                            <Image
                                src="/logo.png"
                                alt="Tafiti AI Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
                            Tafiti AI
                        </span>
                        <p className="text-sm text-gray-500 mt-2">
                            © {new Date().getFullYear()} Tafiti AI. All rights reserved.
                        </p>
                    </div>

                    <div className="flex gap-6 mb-4 md:mb-0">
                        <Link href="/privacy" className="text-gray-500 hover:text-purple-600 transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="text-gray-500 hover:text-purple-600 transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="mailto:contact@tafiti.ai" className="text-gray-500 hover:text-purple-600 transition-colors">
                            Contact
                        </Link>
                    </div>

                    <div className="flex gap-4">
                        <Link href="#" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <Twitter className="w-5 h-5" />
                        </Link>
                        <Link href="#" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <Github className="w-5 h-5" />
                        </Link>
                        <Link href="#" className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <Linkedin className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
