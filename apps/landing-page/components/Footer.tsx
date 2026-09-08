import Link from 'next/link';
import Image from 'next/image';
import { Twitter, Linkedin, Mail, Heart } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Interactive Demo', href: '/demo' },
    { label: 'Capabilities', href: '/features' },
    { label: 'Comparison', href: '/comparison' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Pricing Plans', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
  ],
  Research: [
    { label: 'Simulation Studio', href: '/demo' },
    { label: 'Deep Search Engine', href: 'https://app.tafitiai.co.ke' },
    { label: 'Collaborative Thesis', href: 'https://app.tafitiai.co.ke' },
    { label: 'Smart Citations', href: '/features' },
  ],
  Company: [
    { label: 'Testimonials', href: '/testimonials' },
    { label: 'Why Tafiti AI', href: '/comparison' },
    { label: 'Institutional Sandboxes', href: '/pricing' },
    { label: 'Contact Team', href: 'mailto:hello@tafitiai.co.ke' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-[#030305] border-t border-gray-100 dark:border-white/5">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden">
                <Image
                  src="/android-chrome-192x192.png"
                  alt="Tafiti AI Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                Tafiti AI
              </span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed mb-4">
              AI-powered research platform for African researchers. Discover, analyze, synthesize.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Twitter, href: 'https://twitter.com/tafitiai', label: 'Twitter' },
                { icon: Linkedin, href: 'https://linkedin.com/company/tafitiai', label: 'LinkedIn' },
                { icon: Mail, href: 'mailto:hello@tafitiai.co.ke', label: 'Email' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400 dark:text-gray-600">
            © {new Date().getFullYear()} Tafiti AI. All rights reserved.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-600 flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-red-400 fill-current" /> in Nairobi, Kenya
          </p>
        </div>
      </div>
    </footer>
  );
}
