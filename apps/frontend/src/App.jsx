import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import {
    SignedIn,
    SignedOut,
    SignInButton,
    SignUpButton,
    UserButton,
    useAuth,
    useUser
} from '@clerk/clerk-react';
import Layout from './components/Layout';
import { SearchBox } from './components/SearchBox';
import { PaperCard } from './components/PaperCard';
import { ProfileCard } from './components/ProfileCard';
import { PreferenceForm } from './components/Recommendations';

// Heavy views — lazy-loaded so they only download when first visited
const FeedView = React.lazy(() => import('./components/FeedView').then(m => ({ default: m.FeedView })));
const SynthesisView = React.lazy(() => import('./components/SynthesisView').then(m => ({ default: m.SynthesisView })));
const ProfileView = React.lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const BillingView = React.lazy(() => import('./components/BillingView').then(m => ({ default: m.BillingView })));
const NotesView = React.lazy(() => import('./components/NotesView'));
const DiscoverView = React.lazy(() => import('./components/DiscoverView').then(m => ({ default: m.DiscoverView })));
const ResearchChatView = React.lazy(() => import('./components/ResearchChatView'));
const CollaborationView = React.lazy(() => import('./components/CollaborationView').then(m => ({ default: m.CollaborationView })));
const GapAnalysisView = React.lazy(() => import('./components/GapAnalysisView'));
const SupportView = React.lazy(() => import('./components/SupportView').then(m => ({ default: m.SupportView })));
const CitationGraphView = React.lazy(() => import('./components/CitationGraphView'));
const TrialFeedbackModal = React.lazy(() => import('./components/TrialFeedbackModal'));
const BountiesView = React.lazy(() => import('./components/BountiesView').then(m => ({ default: m.BountiesView || m.default })));
const SandboxesView = React.lazy(() => import('./components/SandboxesView').then(m => ({ default: m.SandboxesView || m.default })));
const AnchorsView = React.lazy(() => import('./components/AnchorsView').then(m => ({ default: m.AnchorsView || m.default })));
import api from './api/client';
import { useToast } from './hooks/useToast';

// Minimal spinner shown while lazy chunks are loading
const ViewFallback = () => (
    <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
);

const PremiumBarrier = ({ title, trialNotStarted, isStartingTrial, handleStartTrial, setActiveTab }) => (
    <div className="flex flex-col items-center justify-center py-32 space-y-8 text-center animate-reveal">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center">
            <CreditCard className="w-10 h-10 text-amber-400" />
        </div>
        <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tight">
                {trialNotStarted ? 'Start Your Free Trial' : 'Trial Expired'}
            </h2>
            <p className="text-slate-400 font-medium max-w-md">
                {trialNotStarted
                    ? `${title} is a premium feature. Start your free 7-day trial to access it.`
                    : `Your free trial has ended. Subscribe for 200 KES/month to continue using ${title}.`}
            </p>
        </div>
        <button
            onClick={trialNotStarted ? handleStartTrial : () => setActiveTab('billing')}
            disabled={isStartingTrial}
            className="btn-primary px-10 py-4 text-base font-black flex items-center gap-3 disabled:opacity-60"
        >
            {isStartingTrial ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {trialNotStarted ? (isStartingTrial ? 'Starting…' : 'Start Free Trial') : 'Upgrade Now'}
        </button>
    </div>
);
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { MessageSquare, Sparkles, Rocket, ArrowRight, Bookmark, User, FileText, History, Loader2, Compass, CreditCard, Users, Settings, HelpCircle, FlaskConical, Trophy, Building2, Shield } from 'lucide-react';

const App = () => {
    const { getToken } = useAuth();
    const { user: clerkUser } = useUser();

    useEffect(() => {
        import('./api/client').then(({ injectToken }) => {
            injectToken(getToken);

            // Check for Paystack callback
            const urlParams = new URLSearchParams(window.location.search);
            const reference = urlParams.get('reference');
            if (reference && clerkUser) {
                handleVerifyPayment(reference);
            }

            if (clerkUser) {
                fetchSimilarResearchers();
            }
        });
    }, [getToken, clerkUser]);

    const [papers, setPapers] = useState([]);
    const [selectedPapers, setSelectedPapers] = useState([]);
    const [synthesis, setSynthesis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [lastQuery, setLastQuery] = useState('');
    const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'library', 'profile', 'notes'

    // Recommendations & Discovery state
    const [recs, setRecs] = useState([]);
    const [isFetchRecs, setIsFetchRecs] = useState(false);
    const [showPreferenceForm, setShowPreferenceForm] = useState(false);
    const [library, setLibrary] = useState([]);
    const [history, setHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [similarResearchers, setSimilarResearchers] = useState([]);
    const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
    const [discoverPapers, setDiscoverPapers] = useState([]);
    const [isLoadingDiscover, setIsLoadingDiscover] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]); // { filename, extracted_text, cid }
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [paperImpacts, setPaperImpacts] = useState({}); // { paperId: impactData }
    const [isImpactLoading, setIsImpactLoading] = useState({}); // { paperId: boolean }
    const [isCollaborative, setIsCollaborative] = useState(false);
    const [followupQuestions, setFollowupQuestions] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [outputLanguage, setOutputLanguage] = useState('English');
    const [synthesisLanguage, setSynthesisLanguage] = useState('English'); // language used for current synthesis
    const [graphPaper, setGraphPaper] = useState(null); // paper to show in citation graph modal
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    // ── Trial state (derived from mergedUser, but computed before useMemo so hooks stay stable) ──
    const [isStartingTrial, setIsStartingTrial] = useState(false);

    const handleStartTrial = async () => {
        setIsStartingTrial(true);
        try {
            const { data } = await api.post('/auth/start-trial');
            setUserProfile(data);          // Update local profile immediately
            toast.success('🎉 Your 7-day free trial has started! Enjoy full access to Tafiti AI.');
        } catch (e) {
            toast.error('Failed to start trial. Please try again.');
        } finally {
            setIsStartingTrial(false);
        }
    };

    // ── Hooks ──────────────────────────────────────────────────────────────────
    const toast = useToast();
    const searchBoxRef = useRef(null);

    useKeyboardShortcuts({
        onFocusSearch: useCallback(() => {
            searchBoxRef.current?.focus();
        }, []),
        onEscape: useCallback(() => {
            if (graphPaper) setGraphPaper(null);
        }, [graphPaper]),
        onSynthesize: useCallback(() => {
            if (selectedPapers.length > 0 && !isSynthesizing) handleSynthesize();
            else if (selectedPapers.length === 0) toast.warn('Select at least one paper before synthesizing. (⌘↵)');
        }, [selectedPapers, isSynthesizing]),
        onShowShortcuts: useCallback(() => {
            toast.info('⌘K · Focus search  |  ⌘↵ · Synthesize  |  Esc · Close modal  |  ? · Help');
        }, []),
    });

    // Merge Clerk user with Backend user profile — memoized to prevent
    // referential instability causing unnecessary child re-renders.
    const mergedUser = useMemo(() => ({
        ...userProfile,
        username: clerkUser?.fullName || clerkUser?.username || userProfile?.username || clerkUser?.firstName || 'Researcher',
        email: clerkUser?.primaryEmailAddress?.emailAddress || userProfile?.email,
        imageUrl: clerkUser?.imageUrl,
        university: userProfile?.university || 'Independent Researcher',
        citation_count: userProfile?.citation_count || 0,
        publications_count: userProfile?.publications_count || 0,
        interest_score: userProfile?.interest_score || 0,
        expertise_areas: userProfile?.expertise_areas || [],
        career_field: userProfile?.career_field || '',
        subscription_status: userProfile?.subscription_status || 'trialing',
        trial_ends_at: userProfile?.trial_ends_at,
        subscription_ends_at: userProfile?.subscription_ends_at,
        notification_count: userProfile?.notification_count || 0,
    }), [userProfile, clerkUser]);

    // ── Derived trial state ───────────────────────────────────────────────────
    const trialNotStarted = !mergedUser.subscription_status || mergedUser.subscription_status === 'inactive';
    const isTrialExpired = mergedUser.subscription_status === 'trialing'
        && mergedUser.trial_ends_at
        && new Date(mergedUser.trial_ends_at) < new Date();
    const isPremiumBlocked = (trialNotStarted || isTrialExpired) && !mergedUser.is_superuser;

    // Show feedback modal when trial expires and user hasn't given feedback yet
    useEffect(() => {
        if (isTrialExpired && !mergedUser.has_given_feedback && !mergedUser.is_superuser) {
            setShowFeedbackModal(true);
        }
    }, [isTrialExpired, mergedUser.has_given_feedback, mergedUser.is_superuser]);

    const fetchUserProfile = async () => {
        if (!clerkUser) return;
        try {
            const response = await api.get('/auth/me');
            setUserProfile(response.data);
        } catch (e) {
            console.warn('Backend profile fetch failed, using Clerk data as fallback', e);
            // Optionally set a minimal profile if not even the basic fetch works
            if (!userProfile) {
                setUserProfile({
                    username: clerkUser.username || clerkUser.firstName,
                    email: clerkUser.primaryEmailAddress?.emailAddress
                });
            }
        }
    };

    const handleVerifyPayment = async (reference) => {
        try {
            const { data } = await api.get(`/billing/verify/${reference}`);
            if (data.status === 'success') {
                fetchUserProfile();
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (e) {
            console.error('Payment verification failed', e);
        }
    };

    const handleSearch = async (query, filters = null) => {
        setIsLoading(true);
        setLastQuery(query);
        setActiveTab('feed');
        try {
            const response = await api.post('/research/search', { query, filters });
            setPapers(response.data.papers);
            setSelectedPapers(response.data.papers);
            setSynthesis('');
            setRecs([]);
            toast.success(`Found ${response.data.papers.length} paper${response.data.papers.length !== 1 ? 's' : ''} for "${query}"`);
        } catch (error) {
            toast.error('Search failed. Check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePaper = async (paper) => {
        try {
            await api.post('/queries/library/papers', paper);
            fetchLibrary();
            toast.success('Paper saved to library!');
        } catch (e) {
            toast.error('Failed to save paper. Please try again.');
        }
    };

    const fetchLibrary = async () => {
        try {
            const response = await api.get('/queries/library/papers');
            setLibrary(response.data);
        } catch (e) {
            console.error('Failed to fetch library', e);
        }
    };

    const handleFetchRecommendations = async (preferences) => {
        setIsFetchRecs(true);
        try {
            // Persist preferences to user profile
            await api.put('/auth/me', {
                career_field: preferences.career_field,
                expertise_areas: preferences.interests
            });
            fetchUserProfile();

            const response = await api.post('/research/recommendations', preferences);
            setRecs(response.data);
            setShowPreferenceForm(false);

            // Refresh personalized papers after profile update
            fetchDiscoverPapers();
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
        } finally {
            setIsFetchRecs(false);
        }
    };

    const handleResearchChat = async (query, sourceIds) => {
        if (!query.trim()) return;

        const newUserMessage = { role: 'user', content: query };
        setMessages(prev => [...prev, newUserMessage]);
        setFollowupQuestions([]); // Reset follow-ups
        setIsChatLoading(true);

        try {
            const response = await fetch(`${api.defaults.baseURL}/research/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`
                },
                body: JSON.stringify({
                    query,
                    history: messages,
                    source_ids: sourceIds,
                    uploaded_text: uploadedFiles.map(f => f.extracted_text).join('\n\n')
                })
            });

            if (!response.ok) throw new Error('Chat failed');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                assistantMessage += parsed.content;
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1].content = assistantMessage;
                                    return newMsgs;
                                });
                            }
                            if (parsed.followup) {
                                setFollowupQuestions(parsed.followup);
                            }
                        } catch (e) {
                            console.error('Error parsing stream:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Research chat failed:', error);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleUploadFile = async (file) => {
        if (isPremiumBlocked) {
            toast.warn('PDF uploads are a premium feature. Please start your free trial or subscribe to continue.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsUploading(true);

        try {
            const response = await fetch(`${api.defaults.baseURL}/uploads/pdf`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await getToken()}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            setUploadedFiles(prev => [...prev, {
                filename: data.filename,
                extracted_text: data.extracted_text,
                cid: data.cid
            }]);
        } catch (error) {
            toast.error('Failed to upload PDF. Please ensure the backend is running.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveUpload = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const fetchSimilarResearchers = async () => {
        setIsLoadingSimilar(true);
        try {
            const response = await api.get('/research/recommendations/researchers');
            setSimilarResearchers(response.data);
        } catch (error) {
            console.error('Failed to fetch similar researchers:', error);
        } finally {
            setIsLoadingSimilar(false);
        }
    };

    const fetchDiscoverPapers = async () => {
        setIsLoadingDiscover(true);
        try {
            const response = await api.get('/research/recommendations/papers');
            setDiscoverPapers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Failed to fetch discover papers:', error);
            setDiscoverPapers([]);
        } finally {
            setIsLoadingDiscover(false);
        }
    };

    const handleConnect = async (targetId) => {
        try {
            await api.post(`/social/connect/${targetId}`);
            toast.success('Connection request sent!');
            fetchUserProfile(); // Update notifications
            fetchSimilarResearchers(); // Refresh list
        } catch (e) {
            toast.error('Failed to send connection request.');
        }
    };

    const handleGetPaperImpact = async (paperId) => {
        if (paperImpacts[paperId]) return;
        setIsImpactLoading(prev => ({ ...prev, [paperId]: true }));
        try {
            const response = await api.post(`/research/papers/${paperId}/impact`);
            setPaperImpacts(prev => ({ ...prev, [paperId]: response.data }));
        } catch (e) {
            console.error('Failed to get paper impact', e);
        } finally {
            setIsImpactLoading(prev => ({ ...prev, [paperId]: false }));
        }
    };

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/social/notifications');
            setNotifications(response.data);
            const countResp = await api.get('/social/notifications/unread-count');
            setUnreadCount(countResp.data.count);
        } catch (e) {
            console.error('Failed to fetch notifications', e);
        }
    };

    const markNotificationRead = async (id) => {
        try {
            await api.put(`/social/notifications/${id}/read`);
            fetchNotifications();
            fetchUserProfile();
        } catch (e) {
            console.error('Failed to mark read', e);
        }
    };

    const togglePaper = (paper) => {
        setSelectedPapers(prev =>
            prev.find(p => p.id === paper.id)
                ? prev.filter(p => p.id !== paper.id)
                : [...prev, paper]
        );
    };

    const handleSynthesize = async () => {
        if (selectedPapers.length === 0) return;

        if (isPremiumBlocked) {
            toast.warn('Synthesis is a premium feature. Please start your free trial or subscribe to continue.');
            return;
        }

        setIsSynthesizing(true);
        setSynthesis('');
        setFollowupQuestions([]); // Reset

        try {
            const token = await getToken();
            const endpoint = isCollaborative ? '/research/synthesize/collaborative' : '/research/synthesize/stream';
            const response = await fetch(`${api.defaults.baseURL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token} `
                },
                body: JSON.stringify({
                    query: lastQuery,
                    papers: selectedPapers,
                    output_language: outputLanguage,
                    project_id: activeTab === 'collaboration' ? selectedProject?.id : null
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                accumulated += parsed.content;
                                setSynthesis(accumulated);
                            }
                        } catch (e) { }
                    }
                }
            }

            setSynthesisLanguage(outputLanguage); // record the language used
            toast.success('Synthesis complete! Scroll down to read.');
            // Save to history automatically
            await api.post('/queries/', {
                title: `Synthesis: ${lastQuery}`,
                query: lastQuery,
                papers: selectedPapers,
                answer: accumulated,
                tags: ['synthesis']
            });
            fetchHistory();
        } catch (error) {
            toast.error('Synthesis failed. Please try again.');
        } finally {
            setIsSynthesizing(false);
        }
    };

    useEffect(() => {
        if (clerkUser) {
            fetchLibrary();
            fetchHistory();
            fetchUserProfile();
            fetchNotifications();
            fetchDiscoverPapers();
        }
    }, [clerkUser]);

    const fetchHistory = async () => {
        try {
            setIsHistoryLoading(true);
            const response = await api.get('/queries/');
            setHistory(response.data);
        } catch (e) {
            console.error('Failed to fetch history', e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleClipPaper = async (paper) => {
        const content = `### ${paper.title}\n\n**Abstract:** ${paper.abstract}\n\n**Citation:** ${paper.authors[0]} et al. (${paper.year}). ${paper.title}.`;
        try {
            await api.post('/notes/', {
                title: `Clip: ${paper.title.slice(0, 50)}...`,
                content: content,
                tags: ['clip', 'paper']
            });
            toast.success('Paper clipped to Notes!');
            setActiveTab('notes');
        } catch (e) {
            toast.error('Failed to clip paper to notes.');
        }
    };

    const handleClipSynthesis = async (answer, papers) => {
        const sources = papers.map((p, i) => `[${i + 1}] ${p.authors[0]} et al. (${p.year}). ${p.title}.`).join('\n');
        const content = `## Research Synthesis\n\n${answer}\n\n### Sources\n${sources}`;
        try {
            await api.post('/notes/', {
                title: `Clip: Synthesis - ${lastQuery.slice(0, 30)}...`,
                content: content,
                tags: ['clip', 'synthesis']
            });
            toast.success('Synthesis clipped to Notes!');
            setActiveTab('notes');
        } catch (e) {
            toast.error('Failed to clip synthesis.');
        }
    };

    const handleClipGapNote = async ({ title, content, tags }) => {
        try {
            await api.post('/notes/', { title, content, tags });
            toast.success('Gap note saved to Notes!');
            setActiveTab('notes');
        } catch (e) {
            toast.error('Failed to save gap note.');
        }
    };

    return (
        <>
            <SignedOut>
                <div className="min-h-screen w-full bg-[var(--bg-main)] relative overflow-hidden flex flex-col">
                    {/* Background glows */}
                    <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/8 blur-[140px] rounded-full pointer-events-none" />
                    <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-violet-600/6 blur-[100px] rounded-full pointer-events-none" />

                    {/* Minimal header */}
                    <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
                        <div className="flex items-center gap-3">
                            <img src="/android-chrome-192x192.png" alt="Tafiti AI" className="w-8 h-8 rounded-xl" />
                            <span className="font-black text-lg tracking-tight text-white">Tafiti AI</span>
                        </div>
                        <SignInButton mode="modal">
                            <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-semibold hover:bg-white/10 transition-all">
                                Sign in
                            </button>
                        </SignInButton>
                    </header>

                    {/* Hero */}
                    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 animate-fade-in">
                            <Sparkles className="w-3.5 h-3.5" />
                            Built for African researchers
                        </div>

                        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05] max-w-3xl animate-reveal">
                            Research smarter.<br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400">Publish faster.</span>
                        </h1>
                        <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-xl leading-relaxed animate-reveal" style={{ animationDelay: '0.1s' }}>
                            AI synthesis, gap analysis, peer review bounties, and IPFS anchoring — purpose-built for academic researchers across Africa.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 mb-20 animate-reveal" style={{ animationDelay: '0.2s' }}>
                            <SignUpButton mode="modal">
                                <button className="btn-primary px-10 py-4 text-base font-black flex items-center justify-center gap-2 group">
                                    Get Started Free
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </SignUpButton>
                            <SignInButton mode="modal">
                                <button className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-base">
                                    Sign In
                                </button>
                            </SignInButton>
                        </div>

                        {/* Feature highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full animate-reveal" style={{ animationDelay: '0.3s' }}>
                            {[
                                { icon: Sparkles, color: 'indigo', title: 'AI Synthesis', desc: 'Multi-paper synthesis in 13 African & global languages' },
                                { icon: FlaskConical, color: 'violet', title: 'Gap Analysis', desc: 'Identify research gaps and future directions automatically' },
                                { icon: Users, color: 'emerald', title: 'Collaboration', desc: 'Invite co-authors, share projects, connect with peers' },
                                { icon: Shield, color: 'amber', title: 'Draft Anchoring', desc: 'Prove prior art with cryptographic SHA-256 hashing' },
                            ].map(({ icon: Icon, color, title, desc }) => (
                                <div key={title} className="glass-card p-6 text-left space-y-3">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-${color}-500/10`}>
                                        <Icon className={`w-5 h-5 text-${color}-400`} />
                                    </div>
                                    <h3 className="font-black text-white text-sm tracking-tight">{title}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                                </div>
                            ))}
                        </div>
                    </main>

                    {/* Footer */}
                    <footer className="relative z-10 text-center py-6 text-xs text-slate-600">
                        © {new Date().getFullYear()} Tafiti AI · tafitiai.co.ke
                    </footer>
                </div>
            </SignedOut>

            <SignedIn>
                <Layout
                    user={mergedUser}
                    unreadNotifications={unreadCount}
                    notifications={notifications}
                    onMarkRead={markNotificationRead}
                    navItems={[
                        { icon: Rocket, label: 'Home', id: 'feed', group: 'Research' },
                        { icon: MessageSquare, label: 'Research Chat', id: 'chat', group: 'Research' },
                        { icon: Compass, label: 'Discover', id: 'discover', group: 'Research' },
                        { icon: Bookmark, label: 'My Library', id: 'library', group: 'Research' },
                        { icon: FlaskConical, label: 'Gap Analysis', id: 'gap-analysis', group: 'Research' },
                        { icon: FileText, label: 'Notes', id: 'notes', group: 'Research' },
                        { icon: History, label: 'History', id: 'history', group: 'Research' },
                        { icon: Users, label: 'Collaboration', id: 'collaboration', group: 'Community' },
                        { icon: Trophy, label: 'Bounties', id: 'bounties', group: 'Community' },
                        { icon: Building2, label: 'Sandboxes', id: 'sandboxes', group: 'Community' },
                        { icon: Shield, label: 'Anchors', id: 'anchors', group: 'Community' },
                        { icon: CreditCard, label: 'Billing & Plans', id: 'billing', group: 'Account' },
                    ].map(item => ({
                        ...item,
                        active: activeTab === item.id,
                        onClick: setActiveTab
                    }))}
                    secondaryNav={[
                        { icon: Settings, label: 'Settings', id: 'profile', active: activeTab === 'profile', onClick: setActiveTab },
                        { icon: HelpCircle, label: 'Support', id: 'support', active: activeTab === 'support', onClick: setActiveTab },
                    ]}
                >
                    <div className="max-w-7xl mx-auto pt-6 pb-24 px-4 sm:pt-12 sm:pb-32 sm:px-8 animate-reveal">

                        {/* ── Trial Banner ──────────────────────────────────────────────────── */}
                        {trialNotStarted && !mergedUser.is_superuser && (
                            <div className="mb-8 rounded-3xl bg-gradient-to-r from-indigo-600/20 via-indigo-500/10 to-emerald-600/20 border border-indigo-500/30 p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                        <Rocket className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-lg tracking-tight">Welcome to Tafiti AI! 🎉</p>
                                        <p className="text-slate-400 text-sm font-medium">Start your free 7-day trial to unlock AI synthesis, gap analysis, and more.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleStartTrial}
                                    disabled={isStartingTrial}
                                    className="shrink-0 btn-primary px-8 py-3 text-sm font-black flex items-center gap-2 disabled:opacity-60"
                                >
                                    {isStartingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    {isStartingTrial ? 'Starting…' : 'Start Free Trial'}
                                </button>
                            </div>
                        )}

                        {/* ── Trial Expired Banner ──────────────────────────────────────────── */}
                        {isTrialExpired && !mergedUser.is_superuser && (
                            <div className="mb-8 rounded-3xl bg-gradient-to-r from-amber-600/15 via-orange-500/10 to-red-600/15 border border-amber-500/30 p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                        <CreditCard className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-lg tracking-tight">Your trial has ended</p>
                                        <p className="text-slate-400 text-sm font-medium">Subscribe for 200 KES/month to continue using synthesis &amp; gap analysis.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTab('billing')}
                                    className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-black px-8 py-3 rounded-2xl text-sm flex items-center gap-2 transition-all"
                                >
                                    <ArrowRight className="w-4 h-4" /> Upgrade Now
                                </button>
                            </div>
                        )}

                        <main className="space-y-12">
                            <Suspense fallback={<ViewFallback />}>
                                {activeTab === 'profile' ? (
                                    <ProfileView
                                        user={mergedUser}
                                        careerField={mergedUser.career_field || 'AI Research'}
                                        onSearch={(q) => { setActiveTab('feed'); handleSearch(q); }}
                                        onProfileUpdate={(updated) => {
                                            setUserProfile(prev => ({ ...prev, ...updated }));
                                            fetchDiscoverPapers();
                                        }}
                                    />
                                ) : activeTab === 'billing' ? (
                                    <BillingView user={mergedUser} />
                                ) : activeTab === 'bounties' ? (
                                    <BountiesView />
                                ) : activeTab === 'sandboxes' ? (
                                    <SandboxesView />
                                ) : activeTab === 'anchors' ? (
                                    <AnchorsView />
                                ) : activeTab === 'support' ? (
                                    <SupportView />
                                ) : activeTab === 'discover' ? (
                                    <DiscoverView
                                        user={mergedUser}
                                        careerField={mergedUser.career_field || 'AI Research'}
                                        onSearch={handleSearch}
                                        recs={recs}
                                        isFetchRecs={isFetchRecs}
                                        similarResearchers={similarResearchers}
                                        isLoadingSimilar={isLoadingSimilar}
                                        onFetchRecommendations={handleFetchRecommendations}
                                        onConnect={handleConnect}
                                        handleSavePaper={handleSavePaper}
                                        discoverPapers={discoverPapers}
                                        isLoadingDiscover={isLoadingDiscover}
                                        onRefreshDiscover={fetchDiscoverPapers}
                                        library={library}
                                    />
                                ) : activeTab === 'collaboration' ? (
                                    <CollaborationView user={mergedUser} />
                                ) : activeTab === 'chat' ? (
                                    isPremiumBlocked ? (
                                        <PremiumBarrier
                                            title="Research Chat"
                                            trialNotStarted={trialNotStarted}
                                            isStartingTrial={isStartingTrial}
                                            handleStartTrial={handleStartTrial}
                                            setActiveTab={setActiveTab}
                                        />
                                    ) : (
                                        <ResearchChatView
                                            isLoading={isChatLoading}
                                            messages={messages}
                                            savedPapers={library}
                                            onSendMessage={handleResearchChat}
                                            onUploadFile={handleUploadFile}
                                            isUploading={isUploading}
                                            uploadedFiles={uploadedFiles}
                                            onRemoveUpload={handleRemoveUpload}
                                            isCollaborative={isCollaborative}
                                            setIsCollaborative={setIsCollaborative}
                                            followupQuestions={followupQuestions}
                                        />
                                    )
                                ) : activeTab === 'notes' ? (
                                    <NotesView />
                                ) : activeTab === 'gap-analysis' ? (
                                    isPremiumBlocked ? (
                                        <PremiumBarrier
                                            title="Gap Analysis"
                                            trialNotStarted={trialNotStarted}
                                            isStartingTrial={isStartingTrial}
                                            handleStartTrial={handleStartTrial}
                                            setActiveTab={setActiveTab}
                                        />
                                    ) : (
                                        <GapAnalysisView
                                            papers={papers}
                                            library={library}
                                            onClipToNotes={handleClipGapNote}
                                        />
                                    )
                                ) : activeTab === 'history' ? (
                                    <div className="space-y-8 sm:space-y-12 animate-reveal">
                                        <header>
                                            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-1 sm:mb-2">Research History</h2>
                                            <p className="text-sm sm:text-base text-slate-500 font-medium tracking-tight">Access your past syntheses and organized research data.</p>
                                        </header>
                                        <div className="grid grid-cols-1 gap-6">
                                            {isHistoryLoading ? (
                                                <div className="flex items-center justify-center py-20">
                                                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                                </div>
                                            ) : history.length > 0 ? (
                                                history.map((item) => (
                                                    <div key={item.id} className="glass-card-heavy p-5 sm:p-8 space-y-4 hover:border-indigo-500/30 transition-all cursor-pointer group" onClick={() => {
                                                        setSynthesis(item.answer);
                                                        setLastQuery(item.query);
                                                        setPapers(item.papers);
                                                        setActiveTab('feed');
                                                    }}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                                                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                                                </div>
                                                                <h3 className="font-black text-xl text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.title}</h3>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">{item.answer}</p>
                                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 pt-4 border-t border-white/5">
                                                            <span>{item.papers.length} Sources</span>
                                                            <div className="flex -space-x-2">
                                                                {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border border-[var(--bg-main)] bg-indigo-500/20" />)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                                                    <p className="text-slate-500 font-medium text-lg">Your research history is empty.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : activeTab === 'feed' ? (
                                    <FeedView
                                        searchBoxRef={searchBoxRef}
                                        papers={papers}
                                        selectedPapers={selectedPapers}
                                        library={library}
                                        history={history}
                                        isLoading={isLoading}
                                        isHistoryLoading={isHistoryLoading}
                                        isSynthesizing={isSynthesizing}
                                        synthesis={synthesis}
                                        synthesisLanguage={synthesisLanguage}
                                        outputLanguage={outputLanguage}
                                        setOutputLanguage={setOutputLanguage}
                                        lastQuery={lastQuery}
                                        followupQuestions={followupQuestions}
                                        paperImpacts={paperImpacts}
                                        isImpactLoading={isImpactLoading}
                                        isPremiumBlocked={isPremiumBlocked}
                                        isStartingTrial={isStartingTrial}
                                        trialNotStarted={trialNotStarted}
                                        showPreferenceForm={showPreferenceForm}
                                        setShowPreferenceForm={setShowPreferenceForm}
                                        isFetchRecs={isFetchRecs}
                                        onSearch={handleSearch}
                                        onSynthesize={handleSynthesize}
                                        onTogglePaper={togglePaper}
                                        onSavePaper={handleSavePaper}
                                        onClipPaper={handleClipPaper}
                                        onImpact={handleGetPaperImpact}
                                        onGraph={p => setGraphPaper(p)}
                                        onClipSynthesis={handleClipSynthesis}
                                        onFetchRecommendations={handleFetchRecommendations}
                                        onRestoreHistory={(item) => {
                                            setSynthesis(item.answer);
                                            setLastQuery(item.query);
                                            setPapers(item.papers);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        onNavigateHistory={() => setActiveTab('history')}
                                        handleStartTrial={handleStartTrial}
                                        setActiveTab={setActiveTab}
                                    />
                                ) : activeTab === 'library' ? (
                                    <div className="space-y-8 animate-reveal">
                                        <header>
                                            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-1 sm:mb-2">Personal Library</h2>
                                            <p className="text-sm sm:text-base text-slate-500 font-medium">Manage your curated research repository.</p>
                                        </header>
                                        {library.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {library.map((paper) => (
                                                    <PaperCard
                                                        key={paper.id}
                                                        paper={paper}
                                                        onSelect={togglePaper}
                                                        isSelected={!!selectedPapers.find(p => p.id === paper.id)}
                                                        onSave={handleSavePaper}
                                                        isSaved={true}
                                                        onGraph={p => setGraphPaper(p)}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="glass-card p-24 text-center space-y-6 border-dashed border-white/5 bg-white/[0.01]">
                                                <h3 className="text-2xl font-black text-white/40 tracking-tight">Your library is empty.</h3>
                                                <p className="text-sm text-slate-500 font-medium leading-relaxed">Save papers to build your personal academic repository.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                                </Suspense>
                            </main>
                        </div>
                    </Layout>

                {/* Citation Graph Modal — rendered outside Layout so it covers the full viewport */}
                {graphPaper && (
                    <CitationGraphView
                        paperId={graphPaper.id}
                        paperTitle={graphPaper.title}
                        onClose={() => setGraphPaper(null)}
                        onSearch={query => {
                            setGraphPaper(null);
                            handleSearch(query);
                        }}
                    />
                )}

                {/* Trial Feedback Modal */}
                {showFeedbackModal && (
                    <Suspense fallback={null}>
                        <TrialFeedbackModal
                            onClose={() => setShowFeedbackModal(false)}
                            onSubmitted={(updatedUser) => {
                                setUserProfile(updatedUser);
                                setShowFeedbackModal(false);
                            }}
                        />
                    </Suspense>
                )}
            </SignedIn>
        </>
    );
};

export default App;
