import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
    FlaskConical, Plus, Play,
    ChevronRight, ChevronDown, Search, FileText,
    AlertTriangle, Zap, BookOpen, Loader2, Brain,
    GitBranch, Eye, ThumbsUp, ThumbsDown, RefreshCw, Users,
    UserPlus, MessageSquare, Target, Sparkles
} from 'lucide-react';
import api from '../api/client';
import SessionStatus from './SessionStatus';

// ── Status Badges ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const styles = {
        active: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        running: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        failed: 'bg-red-500/10 text-red-400 border-red-500/20',
        pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        paused: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        disputed: 'bg-red-500/10 text-red-400 border-red-500/20',
        unverified: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };
    return (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
};

const ConfidenceBar = ({ value }) => (
    <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${
                    value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${value}%` }}
            />
        </div>
        <span className="text-xs text-slate-400 w-8">{value}%</span>
    </div>
);

// ── Create Question Form ─────────────────────────────────────────────────────
const CreateQuestionForm = ({ onSubmit, onCancel }) => {
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        setLoading(true);
        try {
            await onSubmit({ question: question.trim(), description: description.trim() || null });
            setQuestion('');
            setDescription('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <FlaskConical className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">New Research Question</h3>
            </div>
            <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you want to investigate?"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50"
                autoFocus
            />
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional: additional context (e.g., 'PhD thesis on AI ethics in East Africa')"
                rows={2}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
            />
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!question.trim() || loading}
                    className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Question
                </button>
            </div>
        </form>
    );
};

// ── Task Card ────────────────────────────────────────────────────────────────
const TaskCard = ({ task, onExecute }) => {
    const [expanded, setExpanded] = useState(false);
    const iconMap = {
        search: Search,
        literature_review: BookOpen,
        contradiction_search: AlertTriangle,
        dataset_analysis: FileText,
        evidence_extraction: Eye,
        claim_extraction: Brain,
        synthesis: Zap,
    };
    const Icon = iconMap[task.task_type] || FileText;

    return (
        <div className="border border-white/5 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
            >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{task.description}</p>
                    <p className="text-[11px] text-slate-500">{task.task_type.replace(/_/g, ' ')} {task.source_count ? `· ${task.source_count} sources` : ''}</p>
                </div>
                <StatusBadge status={task.status} />
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    <p className="text-xs text-slate-400">{task.description}</p>
                    {task.result_summary && (
                        <div className="p-3 bg-white/[0.02] rounded-lg">
                            <p className="text-[11px] font-medium text-slate-500 mb-1">Result</p>
                            <p className="text-xs text-slate-300">{task.result_summary}</p>
                        </div>
                    )}
                    {task.error && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                            <p className="text-xs text-red-400">{task.error}</p>
                        </div>
                    )}
                    {task.status === 'pending' && (
                        <button
                            onClick={() => onExecute(task.id)}
                            className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
                        >
                            <Play className="w-3 h-3" /> Execute
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Claim Card ───────────────────────────────────────────────────────────────
const ClaimCard = ({ claim, onVerify, onReject }) => (
    <div className="glass-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-white leading-relaxed">{claim.text}</p>
            <StatusBadge status={claim.verification_status} />
        </div>

        <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-500">
                <ThumbsUp className="w-3 h-3 inline mr-1 text-emerald-400" />
                {claim.supporting_count} supporting
            </span>
            <span className="text-[11px] text-slate-500">
                <ThumbsDown className="w-3 h-3 inline mr-1 text-red-400" />
                {claim.contradicting_count} contradicting
            </span>
            <span className="text-[11px] text-slate-500">{claim.claim_type}</span>
        </div>

        <ConfidenceBar value={claim.confidence} />

        {claim.evidence && claim.evidence.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Evidence</p>
                {claim.evidence.map((ev, i) => (
                    <div key={i} className="p-3 bg-white/[0.02] rounded-lg space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                ev.relation === 'supports' ? 'bg-emerald-500/10 text-emerald-400' :
                                ev.relation === 'contradicts' ? 'bg-red-500/10 text-red-400' :
                                'bg-slate-500/10 text-slate-400'
                            }`}>{ev.relation}</span>
                            <span className="text-[11px] text-slate-500">{ev.confidence}% confidence</span>
                        </div>
                        {ev.passage_content && (
                            <p className="text-xs text-slate-400 italic leading-relaxed">"{ev.passage_content}..."</p>
                        )}
                        {ev.source_title && (
                            <p className="text-[11px] text-slate-500">
                                — {ev.source_title} {ev.source_doi && <span className="text-indigo-400">({ev.source_doi})</span>}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        )}

        {claim.verification_status === 'unverified' && (
            <div className="flex gap-2 pt-2">
                <button onClick={() => onVerify(claim.id)} className="px-3 py-1.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> Accept
                </button>
                <button onClick={() => onReject(claim.id)} className="px-3 py-1.5 text-[11px] font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3" /> Reject
                </button>
            </div>
        )}
    </div>
);

// ── Main Workspace View ──────────────────────────────────────────────────────
export const WorkspaceView = () => {
    const { getToken: _getToken } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [claims, setClaims] = useState([]);
    const [graph, setGraph] = useState(null);
    const [synthesis, setSynthesis] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [activeTab, setActiveTab] = useState('tasks');
    const [teams, setTeams] = useState([]);
    const [activeTeam, setActiveTeam] = useState(null);
    const [teamMessages, setTeamMessages] = useState([]);
    const [planLoading, setPlanLoading] = useState(false);

    // Fetch questions
    const fetchQuestions = useCallback(async () => {
        try {
            const { data } = await api.get('/intelligence/questions');
            setQuestions(data);
        } catch (e) {
            console.error('Failed to fetch research questions', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

    // Fetch question details
    const selectQuestion = useCallback(async (q) => {
        setSelectedQuestion(q);
        setActiveTab('tasks');
        try {
            const [tasksRes, claimsRes] = await Promise.all([
                api.get(`/intelligence/questions/${q.id}/tasks`),
                api.get(`/intelligence/questions/${q.id}/claims`),
            ]);
            setTasks(tasksRes.data);
            setClaims(claimsRes.data);
            setSynthesis(null);
            setGraph(null);
        } catch (e) {
            console.error('Failed to fetch question details', e);
        }
    }, []);

    // Create question
    const createQuestion = useCallback(async ({ question, description }) => {
        const { data } = await api.post('/intelligence/questions', { question, description });
        setShowCreateForm(false);
        await fetchQuestions();
        selectQuestion(data);
    }, [fetchQuestions, selectQuestion]);

    // Start research (create tasks)
    const startResearch = useCallback(async () => {
        if (!selectedQuestion) return;
        setExecuting(true);
        try {
            await api.post(`/intelligence/questions/${selectedQuestion.id}/start`);
            // Re-fetch tasks
            const { data } = await api.get(`/intelligence/questions/${selectedQuestion.id}/tasks`);
            setTasks(data);
        } finally {
            setExecuting(false);
        }
    }, [selectedQuestion]);

    // Execute all ready tasks
    const executeAllReady = useCallback(async () => {
        if (!selectedQuestion) return;
        setExecuting(true);
        try {
            await api.post(`/intelligence/questions/${selectedQuestion.id}/execute`);
            const tasksRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/tasks`);
            const claimsRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/claims`);
            setTasks(tasksRes.data);
            setClaims(claimsRes.data);
        } finally {
            setExecuting(false);
        }
    }, [selectedQuestion]);

    // Execute single task
    const executeTask = useCallback(async (taskId) => {
        setExecuting(true);
        try {
            await api.post(`/intelligence/tasks/${taskId}/execute`);
            const tasksRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/tasks`);
            const claimsRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/claims`);
            setTasks(tasksRes.data);
            setClaims(claimsRes.data);
        } finally {
            setExecuting(false);
        }
    }, [selectedQuestion]);

    // Fetch evidence graph
    const fetchGraph = useCallback(async () => {
        if (!selectedQuestion) return;
        const { data } = await api.get(`/intelligence/questions/${selectedQuestion.id}/graph`);
        setGraph(data);
    }, [selectedQuestion]);

    // Synthesize
    const runSynthesis = useCallback(async () => {
        if (!selectedQuestion) return;
        setExecuting(true);
        try {
            const { data } = await api.post(`/intelligence/questions/${selectedQuestion.id}/synthesize`);
            setSynthesis(data);
        } finally {
            setExecuting(false);
        }
    }, [selectedQuestion]);

    // Verify/reject claim
    const verifyClaim = useCallback(async (claimId) => {
        await api.patch(`/intelligence/claims/${claimId}`, {
            verification_status: 'verified',
            user_verdict: 'accepted',
            reviewed_by_user: true,
        });
        const claimsRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/claims`);
        setClaims(claimsRes.data);
    }, [selectedQuestion]);


    // -- Teams --
    const fetchTeams = useCallback(async () => {
        if (!selectedQuestion) return;
        try {
            const { data } = await api.get('/teams?question_id=' + selectedQuestion.id);
            setTeams(data);
        } catch (e) { console.error('Failed to fetch teams', e); }
    }, [selectedQuestion]);

    const fetchTeamDetail = useCallback(async (teamId) => {
        try {
            const { data } = await api.get('/teams/' + teamId);
            setActiveTeam(data);
            setTeamMessages(data.recent_messages || []);
        } catch (e) { console.error('Failed to fetch team detail', e); }
    }, []);

    const generatePlan = useCallback(async () => {
        if (!selectedQuestion) return;
        setPlanLoading(true);
        try {
            const { data } = await api.post('/plan', { question_id: selectedQuestion.id });
            await fetchTeams();
            if (data.team_id) await fetchTeamDetail(data.team_id);
        } catch (e) { console.error('Failed to generate plan', e); }
        finally { setPlanLoading(false); }
    }, [selectedQuestion, fetchTeams, fetchTeamDetail]);

    const activateTeam = useCallback(async (teamId, plan) => {
        try {
            await api.post('/teams/' + teamId + '/activate', { plan });
            await fetchTeamDetail(teamId);
        } catch (e) { console.error('Failed to activate team', e); }
    }, [fetchTeamDetail]);

    const spawnAgentInTeam = useCallback(async (teamId, role, description) => {
        try {
            await api.post('/teams/' + teamId + '/agents', { role, description });
            await fetchTeamDetail(teamId);
        } catch (e) { console.error('Failed to spawn agent', e); }
    }, [fetchTeamDetail]);

    useEffect(() => {
        if (selectedQuestion && activeTab === 'teams') fetchTeams();
    }, [selectedQuestion, activeTab, fetchTeams]);

    const rejectClaim = useCallback(async (claimId) => {
        await api.patch(`/intelligence/claims/${claimId}`, {
            verification_status: 'disputed',
            user_verdict: 'rejected',
            reviewed_by_user: true,
        });
        const claimsRes = await api.get(`/intelligence/questions/${selectedQuestion.id}/claims`);
        setClaims(claimsRes.data);
    }, [selectedQuestion]);

    // Compute stats
    const stats = {
        tasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        sources: tasks.reduce((acc, t) => acc + (t.source_count || 0), 0),
        claims: claims.length,
        verified: claims.filter(c => c.verification_status === 'verified').length,
        disputed: claims.filter(c => c.verification_status === 'disputed').length,
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-reveal">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Brain className="w-7 h-7 text-indigo-400" />
                        Research Workspace
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Evidence-based research with auditable claims, sources, and reasoning
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Question
                </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
                <CreateQuestionForm onSubmit={createQuestion} onCancel={() => setShowCreateForm(false)} />
            )}

            <div className="flex gap-6">
                {/* Sidebar: Questions List */}
                <div className="w-80 shrink-0 space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">
                        Research Questions ({questions.length})
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-12 glass-card">
                            <FlaskConical className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">No research questions yet</p>
                            <p className="text-xs text-slate-600 mt-1">Create one to start investigating</p>
                        </div>
                    ) : (
                        questions.map((q) => (
                            <button
                                key={q.id}
                                onClick={() => selectQuestion(q)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                                    selectedQuestion?.id === q.id
                                        ? 'border-indigo-500/30 bg-indigo-500/5 shadow-lg shadow-indigo-500/5'
                                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-white leading-snug line-clamp-2">{q.question}</p>
                                    <StatusBadge status={q.status} />
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                                    <span>{q.task_count || 0} tasks</span>
                                    <span>{q.claim_count || 0} claims</span>
                                    <span>{new Date(q.created_at).toLocaleDateString()}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {!selectedQuestion ? (
                        <div className="flex flex-col items-center justify-center py-24 glass-card">
                            <Brain className="w-16 h-16 text-slate-700 mb-4" />
                            <h2 className="text-lg font-bold text-slate-400">Select a Research Question</h2>
                            <p className="text-sm text-slate-500 mt-2 max-w-md text-center">
                                Create a new question or select an existing one to start building an evidence-based investigation
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Question Header */}
                            <div className="glass-card p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{selectedQuestion.question}</h2>
                                        {selectedQuestion.description && (
                                            <p className="text-sm text-slate-400 mt-1">{selectedQuestion.description}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {tasks.length === 0 ? (
                                            <button
                                                onClick={startResearch}
                                                disabled={executing}
                                                className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                                Start Research
                                            </button>
                                        ) : (
                                            <button
                                                onClick={executeAllReady}
                                                disabled={executing}
                                                className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                                Execute Ready
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-white/5">
                                    {[
                                        { label: 'Tasks', value: stats.completedTasks, total: stats.tasks, color: 'indigo' },
                                        { label: 'Sources', value: stats.sources, color: 'blue' },
                                        { label: 'Claims', value: stats.claims, color: 'purple' },
                                        { label: 'Verified', value: stats.verified, color: 'emerald' },
                                        { label: 'Disputed', value: stats.disputed, color: 'red' },
                                    ].map(({ label, value, total, color }) => (
                                        <div key={label} className="text-center">
                                            <p className={`text-lg font-black text-${color}-400`}>
                                                {value}{total !== undefined ? <span className="text-xs font-normal text-slate-500">/{total}</span> : ''}
                                            </p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Session Status */}
                            <SessionStatus questionId={selectedQuestion.id} onRefresh={() => selectQuestion(selectedQuestion)} />

                            {/* Tabs */}
                            <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/5">
                                {[
                                    { id: 'tasks', label: 'Tasks', icon: GitBranch },
                                    { id: 'claims', label: 'Claims', icon: Brain },
                                    { id: 'graph', label: 'Evidence Graph', icon: Eye },
                                    { id: 'synthesis', label: 'Synthesis', icon: Zap },
                                    { id: 'teams', label: 'Teams', icon: Users },
                                ].map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => {
                                            setActiveTab(id);
                                            if (id === 'graph' && !graph) fetchGraph();
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                            activeTab === id
                                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'tasks' && (
                                <div className="space-y-2">
                                    {tasks.length === 0 ? (
                                        <div className="text-center py-12 glass-card">
                                            <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                            <p className="text-sm text-slate-500">No tasks yet</p>
                                            <p className="text-xs text-slate-600 mt-1">Click "Start Research" to create a task plan</p>
                                        </div>
                                    ) : (
                                        tasks.map((task) => (
                                            <TaskCard key={task.id} task={task} onExecute={executeTask} />
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'claims' && (
                                <div className="space-y-3">
                                    {claims.length === 0 ? (
                                        <div className="text-center py-12 glass-card">
                                            <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                            <p className="text-sm text-slate-500">No claims extracted yet</p>
                                            <p className="text-xs text-slate-600 mt-1">Run claim extraction tasks to generate claims</p>
                                        </div>
                                    ) : (
                                        claims.map((claim) => (
                                            <ClaimCard
                                                key={claim.id}
                                                claim={claim}
                                                onVerify={verifyClaim}
                                                onReject={rejectClaim}
                                            />
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'graph' && (
                                <div className="glass-card p-6">
                                    {!graph ? (
                                        <div className="text-center py-8">
                                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                                            <p className="text-sm text-slate-500 mt-2">Loading evidence graph...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Eye className="w-5 h-5 text-indigo-400" />
                                                <h3 className="text-sm font-bold text-white">Evidence Graph</h3>
                                                <button onClick={fetchGraph} className="ml-auto p-1.5 rounded-lg hover:bg-white/5">
                                                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                <div className="p-3 bg-white/[0.02] rounded-lg text-center">
                                                    <p className="text-lg font-black text-indigo-400">{graph.claims?.length || 0}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">Claims</p>
                                                </div>
                                                <div className="p-3 bg-white/[0.02] rounded-lg text-center">
                                                    <p className="text-lg font-black text-blue-400">{graph.sources || 0}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">Sources</p>
                                                </div>
                                                <div className="p-3 bg-white/[0.02] rounded-lg text-center">
                                                    <p className="text-lg font-black text-purple-400">{graph.evidence || 0}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase">Evidence Items</p>
                                                </div>
                                                <div className="p-3 bg-white/[0.02] rounded-lg text-center">
                                                    <p className="text-lg font-black text-emerald-400">
                                                        {graph.claims?.filter(c => c.verification_status === 'verified').length || 0}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 uppercase">Verified</p>
                                                </div>
                                            </div>

                                            {graph.claims?.map((claim) => (
                                                <div key={claim.id} className="border border-white/5 rounded-xl p-4 space-y-2">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <p className="text-sm text-white">{claim.text}</p>
                                                        <StatusBadge status={claim.verification_status} />
                                                    </div>
                                                    <ConfidenceBar value={claim.confidence} />
                                                    {claim.evidence?.map((ev, i) => (
                                                        <div key={i} className="ml-4 pl-3 border-l-2 border-indigo-500/20 py-1">
                                                            <span className={`text-[10px] font-bold uppercase ${
                                                                ev.relation === 'supports' ? 'text-emerald-400' :
                                                                ev.relation === 'contradicts' ? 'text-red-400' :
                                                                'text-slate-400'
                                                            }`}>{ev.relation}</span>
                                                            {ev.source_title && (
                                                                <p className="text-[11px] text-slate-400 mt-0.5">{ev.source_title}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'synthesis' && (
                                <div className="glass-card p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-indigo-400" />
                                            <h3 className="text-sm font-bold text-white">Research Synthesis</h3>
                                        </div>
                                        <button
                                            onClick={runSynthesis}
                                            disabled={executing || claims.length === 0}
                                            className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                            Generate Synthesis
                                        </button>
                                    </div>

                                    {!synthesis ? (
                                        <div className="text-center py-12">
                                            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                            <p className="text-sm text-slate-500">
                                                {claims.length === 0
                                                    ? 'Extract claims first, then generate a synthesis'
                                                    : 'Click "Generate Synthesis" to produce a comprehensive report'
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                {synthesis.synthesis.split('\n').map((line, i) => (
                                                    <p key={i} className="text-sm text-slate-300 leading-relaxed">
                                                        {line.startsWith('**') ? (
                                                            <strong className="text-white">{line.replace(/\*\*/g, '')}</strong>
                                                        ) : line}
                                                    </p>
                                                ))}
                                            </div>

                                            {synthesis.next_steps?.length > 0 && (
                                                <div className="mt-6 pt-4 border-t border-white/5">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Suggested Next Steps</h4>
                                                    <div className="space-y-2">
                                                        {synthesis.next_steps.map((step, i) => (
                                                            <div key={i} className="flex items-start gap-2 p-3 bg-white/[0.02] rounded-lg">
                                                                <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                                                <p className="text-xs text-slate-300">{step}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'teams' && (
                                <TeamsTab
                                    teams={teams}
                                    activeTeam={activeTeam}
                                    teamMessages={teamMessages}
                                    planLoading={planLoading}
                                    onGeneratePlan={generatePlan}
                                    onActivateTeam={activateTeam}
                                    onSpawnAgent={spawnAgentInTeam}
                                    onFetchDetail={fetchTeamDetail}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// -- Teams Tab Component --
const TeamsTab = ({ teams, activeTeam, teamMessages, planLoading, onGeneratePlan, onActivateTeam, onSpawnAgent, onFetchDetail }) => (
    <div className="space-y-4">
        <div className="glass-card p-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Research Teams</h3>
                </div>
                <button onClick={onGeneratePlan} disabled={planLoading} className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50">
                    {planLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate Plan
                </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Dynamic research teams inspired by Google AntiGravity. Agents spawn on-demand and coordinate via message passing.</p>
        </div>
        {teams.length === 0 ? (
            <div className="text-center py-12 glass-card">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No research teams yet</p>
                <p className="text-xs text-slate-600 mt-1">Click "Generate Plan" to create a collaborative research team</p>
            </div>
        ) : teams.map((team) => (
            <div key={team.id} className="glass-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-sm font-bold text-white">{team.name || 'Research Team'}</h4>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                            <StatusBadge status={team.status} />
                            <span>{team.agent_count || 0} agents</span>
                            <span>{team.active_agents || 0} active</span>
                        </div>
                    </div>
                    {team.status === 'forming' && (
                        <button onClick={() => onActivateTeam(team.id, team.team_plan)} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
                            <Play className="w-3 h-3" /> Activate Team
                        </button>
                    )}
                </div>
                {activeTeam?.id === team.id && activeTeam.agents?.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Agents</h5>
                        <div className="grid grid-cols-2 gap-2">
                            {activeTeam.agents.map((agent) => (
                                <div key={agent.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-white">{agent.name}</span>
                                        <StatusBadge status={agent.status} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{agent.role}</p>
                                    <p className="text-[10px] text-slate-600 mt-0.5">{(agent.description || '').slice(0, 60)}...</p>
                                    {agent.sub_agent_count > 0 && <span className="text-[10px] text-indigo-400 mt-1 inline-block">+{agent.sub_agent_count} sub-agents</span>}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                            {['researcher', 'critic', 'scout', 'extractor', 'synthesist'].map((role) => (
                                <button key={role} onClick={() => onSpawnAgent(team.id, role, role + ' for research')}
                                    className="px-3 py-1.5 text-[10px] font-medium rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-slate-400 hover:text-white transition-all flex items-center gap-1">
                                    <UserPlus className="w-2.5 h-2.5" /> {role}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {activeTeam?.id === team.id && teamMessages.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Agent Messages</h5>
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2">
                            {teamMessages.map((msg) => (
                                <div key={msg.id} className="flex items-start gap-2 p-2 bg-white/[0.02] rounded-lg">
                                    <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium text-indigo-400">{msg.sender_name}</span>
                                            <span className="text-[9px] text-slate-600">{msg.message_type}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">{(msg.content || '').slice(0, 150)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTeam?.id === team.id && team.team_plan?.phases && (
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Research Plan</h5>
                        <div className="space-y-1.5">
                            {team.team_plan.phases.map((phase, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-white/[0.02] rounded-lg">
                                    <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span className="text-[11px] font-medium text-white">{phase.name}</span>
                                    <span className="text-[10px] text-slate-500">{(phase.agent_roles || []).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTeam?.id !== team.id && (
                    <button onClick={() => onFetchDetail(team.id)} className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" /> View details
                    </button>
                )}
            </div>
        ))}
    </div>
);


export default WorkspaceView;
