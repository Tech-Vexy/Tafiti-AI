import React, { useState } from 'react';
import { ProfileCard } from './ProfileCard';
import { DiscoveryFeed } from './DiscoveryFeed';
import { CollaboratorsView } from './CollaboratorsView';
import { User, Activity, Briefcase, Edit3, Save, X, Loader2 } from 'lucide-react';
import api from '../api/client';

export const ProfileView = ({ user, careerField, onSearch }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        bio: user.bio || '',
        university: user.university || '',
        career_field: careerField || '',
        expertise_areas: user.expertise_areas || []
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await api.put('/auth/me', formData);
            setIsEditing(false);
            // In a real app, we'd trigger a global user profile refresh here
            window.location.reload();
        } catch (err) {
            console.error('Failed to update profile:', err);
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-white">Academic Profile</h2>
                        <p className="text-[var(--text-dim)] font-medium">Manage your research presence and discover new frontiers.</p>
                    </div>
                </div>

                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 font-bold transition-all active:scale-95"
                    >
                        <Edit3 className="w-4 h-4" />
                        Edit Profile
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold animate-shake">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Profile Details */}
                <div className="lg:col-span-1 space-y-6">
                    {isEditing ? (
                        <div className="glass-card p-8 border-indigo-500/20 space-y-6 animate-slide-up">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bio</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none min-h-[120px]"
                                    placeholder="Tell the world about your research..."
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">University / Institution</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                                    type="text"
                                    placeholder="e.g. Stanford University"
                                    value={formData.university}
                                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Career Field</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
                                    type="text"
                                    placeholder="e.g. Quantum Computing"
                                    value={formData.career_field}
                                    onChange={(e) => setFormData({ ...formData, career_field: e.target.value })}
                                />
                            </div>
                        </div>
                    ) : (
                        <ProfileCard user={user} />
                    )}

                    <div className="glass-card p-6 border-white/5 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                            <Briefcase className="w-3 h-3" /> Career Overview
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--text-dim)]">Current Field</span>
                                <span className="text-xs font-bold text-white">{careerField || 'Not set'}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-[65%]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Detailed Stats */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="glass-card-heavy p-8 border-white/5 relative overflow-hidden h-full flex flex-col justify-center text-center">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -z-10" />
                        <h3 className="text-2xl font-black text-white mb-2">Impact Analytics</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">Your influence across the academic network. These metrics are updated in real-time based on your saved research.</p>

                        <div className="grid grid-cols-3 gap-8">
                            <div className="space-y-1">
                                <div className="text-4xl font-black text-indigo-400">{user.citation_count || 0}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Citations</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-4xl font-black text-emerald-400">{user.publications_count || 0}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Publications</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-4xl font-black text-orange-400">{user.interest_score || 0}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interests</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
