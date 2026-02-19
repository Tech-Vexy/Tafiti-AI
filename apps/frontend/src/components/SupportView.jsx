import React, { useState } from 'react';
import { HelpCircle, MessageSquare, Mail, ExternalLink, ChevronDown, BookOpen, Github, FileText, Rocket } from 'lucide-react';

const FAQ_ITEMS = [
    {
        question: 'How do I synthesize papers?',
        answer: 'Search for a topic, select the papers you want to include, then click the "Synthesize" button. Tafiti AI will generate a comprehensive summary that connects insights from all selected papers.'
    },
    {
        question: 'What is the Research Chat?',
        answer: 'Research Chat is an AI-powered conversational interface where you can ask follow-up questions about your papers, upload PDFs for analysis, and get deeper insights from your research library.'
    },
    {
        question: 'How does Gap Analysis work?',
        answer: 'Gap Analysis examines your research collection to identify underexplored areas, missing connections, and potential directions for future investigation. It helps you discover what the literature hasn\'t covered yet.'
    },
    {
        question: 'Can I collaborate with other researchers?',
        answer: 'Yes! Use the Collaboration tab to find similar researchers, send connection requests, and work together on shared projects. You can co-author syntheses and share your library with collaborators.'
    },
    {
        question: 'How do I manage my subscription?',
        answer: 'Navigate to the Billing & Plans section from the sidebar. There you can view your current plan, start a free trial, or upgrade to a premium subscription for unlimited access to all features.'
    },
    {
        question: 'Is my research data private?',
        answer: 'Absolutely. Your saved papers, notes, and research history are private to your account. We do not share your data with third parties. Collaboration features are opt-in only.'
    },
];

const CONTACT_CHANNELS = [
    {
        icon: Mail,
        title: 'Email Support',
        description: 'Get help from our team directly.',
        action: 'support@tafiti.ai',
        href: 'mailto:support@tafiti.ai',
        accent: 'indigo',
    },
    {
        icon: Github,
        title: 'GitHub Issues',
        description: 'Report bugs or request features.',
        action: 'Open GitHub',
        href: 'https://github.com/Tafiti-AI',
        accent: 'slate',
    },
    {
        icon: BookOpen,
        title: 'Documentation',
        description: 'Browse guides and tutorials.',
        action: 'View Docs',
        href: 'https://docs.tafiti.ai',
        accent: 'emerald',
    },
];

const accentMap = {
    indigo: {
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
        text: 'text-indigo-400',
        hoverBorder: 'hover:border-indigo-500/30',
    },
    slate: {
        bg: 'bg-white/5',
        border: 'border-white/10',
        text: 'text-slate-300',
        hoverBorder: 'hover:border-white/20',
    },
    emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        hoverBorder: 'hover:border-emerald-500/30',
    },
};

const FaqItem = ({ item }) => {
    const [open, setOpen] = useState(false);

    return (
        <button
            onClick={() => setOpen(!open)}
            className="w-full text-left glass-card p-6 space-y-3 hover:border-indigo-500/20 transition-all duration-300 group"
        >
            <div className="flex items-center justify-between gap-4">
                <h4 className="font-bold text-white group-hover:text-indigo-300 transition-colors">{item.question}</h4>
                <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-indigo-400' : ''}`} />
            </div>
            {open && (
                <p className="text-sm text-slate-400 leading-relaxed pr-8 animate-fade-in">{item.answer}</p>
            )}
        </button>
    );
};

export const SupportView = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-fade-in py-10">
            {/* Header */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
                    <HelpCircle className="w-4 h-4" />
                    Help & Resources
                </div>
                <h2 className="text-5xl font-black tracking-tight text-white italic">Support Center</h2>
                <p className="text-slate-400 max-w-xl mx-auto font-medium">Find answers, get in touch, or explore our documentation.</p>
            </div>

            {/* Contact Channels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CONTACT_CHANNELS.map((channel) => {
                    const colors = accentMap[channel.accent];
                    return (
                        <a
                            key={channel.title}
                            href={channel.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`glass-card-heavy p-8 flex flex-col items-center text-center space-y-4 ${colors.hoverBorder} transition-all duration-500 group`}
                        >
                            <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center ${colors.text} group-hover:scale-110 transition-transform duration-500`}>
                                <channel.icon className="w-7 h-7" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-black text-white text-lg tracking-tight">{channel.title}</h3>
                                <p className="text-sm text-slate-500 font-medium">{channel.description}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${colors.text}`}>
                                {channel.action}
                                <ExternalLink className="w-3 h-3" />
                            </span>
                        </a>
                    );
                })}
            </div>

            {/* FAQ Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight text-white">Frequently Asked Questions</h3>
                        <p className="text-sm text-slate-500 font-medium">Quick answers to common questions.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {FAQ_ITEMS.map((item) => (
                        <FaqItem key={item.question} item={item} />
                    ))}
                </div>
            </div>

            {/* Quick Links */}
            <div className="glass-card-heavy p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                        <Rocket className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Quick Links</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                        { label: 'Getting Started Guide', href: 'https://docs.tafiti.ai/getting-started', icon: BookOpen },
                        { label: 'Release Notes & Changelog', href: 'https://github.com/Tafiti-AI/releases', icon: FileText },
                        { label: 'Community Discussions', href: 'https://github.com/Tafiti-AI/discussions', icon: MessageSquare },
                        { label: 'Report a Bug', href: 'https://github.com/Tafiti-AI/issues/new', icon: HelpCircle },
                    ].map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all group"
                        >
                            <link.icon className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                            <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{link.label}</span>
                            <ExternalLink className="w-3 h-3 text-slate-600 ml-auto group-hover:text-indigo-400 transition-colors" />
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};
