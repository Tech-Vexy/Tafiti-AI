import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Folder, Calendar, ChevronRight,
    Activity, Shield, MessageSquare, PlusCircle,
    UserPlus, Loader2, BookOpen, FileText, ArrowRight
} from 'lucide-react';
import api from '../api/client';

export const CollaborationView = ({ user }) => {
    const [projects, setProjects] = useState([]);
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState({ title: '', description: '' });
    const [selectedProject, setSelectedProject] = useState(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/collaboration/projects');
            setProjects(response.data);
            if (response.data.length > 0 && !selectedProject) {
                handleSelectProject(response.data[0]);
            }
        } catch (e) {
            console.error('Failed to fetch projects', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectProject = async (project) => {
        setSelectedProject(project);
        try {
            const response = await api.get(`/collaboration/projects/${project.id}/activity`);
            setActivities(response.data);
        } catch (e) {
            console.error('Failed to fetch activity', e);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/collaboration/projects', newProject);
            setProjects(prev => [...prev, response.data]);
            setShowCreateModal(false);
            setNewProject({ title: '', description: '' });
            handleSelectProject(response.data);
        } catch (e) {
            console.error('Failed to create project', e);
        }
    };

    if (isLoading && projects.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-reveal pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black tracking-tight text-white mb-2">Collaboration Hub</h2>
                    <p className="text-slate-500 font-medium">Coordinate research efforts with your scholarly network.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary py-3 px-6 text-sm flex items-center gap-3"
                >
                    <Plus className="w-4 h-4" /> New Project
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Projects Sidebar */}
                <aside className="lg:col-span-4 space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 px-2">
                        <Folder className="w-3 h-3" /> Active Projects
                    </h3>
                    <div className="space-y-3">
                        {projects.length > 0 ? (
                            projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleSelectProject(project)}
                                    className={`w-full p-6 rounded-[2rem] border transition-all duration-500 text-left group ${selectedProject?.id === project.id ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedProject?.id === project.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-500 group-hover:text-white'}`}>
                                            <Folder className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h4 className={`font-black tracking-tight mb-2 ${selectedProject?.id === project.id ? 'text-white' : 'text-slate-300'}`}>
                                        {project.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 line-clamp-2 font-medium leading-relaxed">
                                        {project.description || 'No description provided.'}
                                    </p>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-sm text-slate-500 font-medium">No projects yet.</p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Project Details */}
                <main className="lg:col-span-8 space-y-12">
                    {selectedProject ? (
                        <div className="space-y-12 animate-tab-in">
                            <div className="glass-card-heavy p-10 border-indigo-500/10 space-y-8">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                                            <Shield className="w-3 h-3" /> Project Workspace
                                        </div>
                                        <h1 className="text-3xl font-black tracking-tight text-white">{selectedProject.title}</h1>
                                        <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">{selectedProject.description}</p>
                                    </div>
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-12 h-12 rounded-2xl border-4 border-[var(--bg-card)] bg-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-400">
                                                U{i}
                                            </div>
                                        ))}
                                        <button className="w-12 h-12 rounded-2xl border-4 border-[var(--bg-card)] bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/5">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Shared Library</span>
                                        <p className="text-xl font-black text-white">0 Papers</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Shared Notes</span>
                                        <p className="text-xl font-black text-white">0 Notes</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Team Members</span>
                                        <p className="text-xl font-black text-white">1 Active</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section Tabs */}
                            <div className="space-y-8">
                                <h3 className="text-xl font-black tracking-tight flex items-center gap-4">
                                    <Activity className="text-emerald-400" />
                                    Recent Activity
                                </h3>
                                <div className="space-y-4">
                                    {activities.length > 0 ? (
                                        activities.map((activity) => (
                                            <div key={activity.id} className="glass-card p-6 border-white/5 flex items-start gap-4 group">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-emerald-400 transition-colors">
                                                    <Activity className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-300 mb-1">{activity.content}</p>
                                                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                                                        {new Date(activity.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-12 text-center text-slate-500 font-medium italic">
                                            No recent activity in this workspace.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[3rem]">
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto flex items-center justify-center text-slate-600">
                                    <ArrowRight className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-black text-white/40">Select a project to begin.</h3>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
                    <div className="glass-card-heavy w-full max-w-lg p-10 border-white/10 shadow-2xl animate-modal-in">
                        <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4">
                            <PlusCircle className="text-indigo-400" />
                            Launch New Project
                        </h3>
                        <form onSubmit={handleCreateProject} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Project Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Quantum Computing Synergy"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/30 transition-all font-bold"
                                    value={newProject.title}
                                    onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Description</label>
                                <textarea
                                    rows="4"
                                    placeholder="Define the scope and goals of this collaboration..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/30 transition-all font-medium text-sm"
                                    value={newProject.description}
                                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 btn-primary py-4 rounded-2xl font-black uppercase tracking-widest text-xs"
                                >
                                    Initialize Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
