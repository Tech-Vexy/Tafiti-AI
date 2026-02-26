import React, { useState } from 'react';
import { ProfileCard } from './ProfileCard';
import { DiscoveryFeed } from './DiscoveryFeed';
import {
    User, Briefcase, Edit3, Save, X, Loader2,
    BookOpen, Star, Tag, Plus, ExternalLink
} from 'lucide-react';
import api from '../api/client';

// ─── Tag Input for expertise_areas ───────────────────────────────────────────
const TagInput = ({ tags, onChange }) => {
    const [input, setInput] = useState('');

    const addTag = () => {
        const trimmed = input.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
        }
        setInput('');
    };

    const removeTag = (tag) => onChange(tags.filter(t => t !== tag));

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2 min-h-[36px]">
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-medium text-indigo-300"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-indigo-400 hover:text-white transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type an interest and press Enter…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none transition-all"
                />
                <button
                    type="button"
                    onClick={addTag}
                    disabled={!input.trim()}
                    className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-40"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <p className="text-[11px] text-slate-500">Press Enter or comma to add a tag.</p>
        </div>
    );
};

// ─── Main ProfileView ─────────────────────────────────────────────────────────
export const ProfileView = ({ user, careerField, onSearch, onProfileUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        bio: user.bio || '',
        university: user.university || '',
        career_field: careerField || '',
        expertise_areas: user.expertise_areas || [],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const response = await api.put('/auth/me', formData);
            setIsEditing(false);
            // Notify parent to update global user state without a full page reload
            if (onProfileUpdate) {
                onProfileUpdate({ ...user, ...formData, career_field: formData.career_field });
            }
        } catch (err) {
            console.error('Failed to update profile:', err);
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            bio: user.bio || '',
            university: user.university || '',
            career_field: careerField || '',
            expertise_areas: user.expertise_areas || [],
        });
        setIsEditing(false);
        setError(null);
    };

    const inputClass =
        'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none';
    const labelClass =
        'text-xs font-semibold uppercase tracking-wide text-slate-500';

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Your Profile</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Manage your research identity and interests.</p>
                    </div>
                </div>

                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-semibold text-sm transition-all"
                    >
                        <Edit3 className="w-4 h-4" />
                        Edit Profile
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-5 py-2.5 text-slate-400 font-semibold text-sm hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column */}
                <div className="lg:col-span-1 space-y-5">
                    {isEditing ? (
                        <div className="glass-card p-6 border-indigo-500/20 space-y-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className={labelClass}>Bio</label>
                                <textarea
                                    className={inputClass + ' min-h-[100px] resize-none'}
                                    placeholder="Describe your research interests and background…"
                                    value={formData.bio}
                                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>University / Institution</label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g. University of Nairobi"
                                    value={formData.university}
                                    onChange={e => setFormData({ ...formData, university: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass}>Career Field</label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g. Biomedical Engineering"
                                    value={formData.career_field}
                                    onChange={e => setFormData({ ...formData, career_field: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className={labelClass + ' flex items-center gap-1.5'}>
                                    <Tag className="w-3 h-3" /> Research Interests
                                </label>
                                <TagInput
                                    tags={formData.expertise_areas}
                                    onChange={tags => setFormData({ ...formData, expertise_areas: tags })}
                                />
                            </div>
                        </div>
                    ) : (
                        <ProfileCard user={user} />
                    )}

                    {/* Career Overview */}
                    <div className="glass-card p-5 border-white/5 space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                            <Briefcase className="w-3 h-3" /> Career Overview
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">Field</span>
                                <span className="font-semibold text-white">
                                    {formData.career_field || careerField || 'Not set'}
                                </span>
                            </div>
                            {user?.expertise_areas?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {user.expertise_areas.map((area, i) => (
                                        <span
                                            key={i}
                                            className="px-2.5 py-1 bg-white/5 rounded-full text-[11px] text-slate-400 border border-white/5"
                                        >
                                            {area}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right column — stats */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card-heavy p-8 border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -z-10" />
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white">Research Activity</h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Metrics based on your saved research and profile data.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="glass-card p-5 border-white/5 text-center space-y-1">
                                <div className="text-3xl font-bold text-indigo-400">
                                    {user.citation_count ?? 0}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">Citations</div>
                            </div>
                            <div className="glass-card p-5 border-white/5 text-center space-y-1">
                                <div className="text-3xl font-bold text-emerald-400">
                                    {user.publications_count ?? 0}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">Publications</div>
                            </div>
                            <div className="glass-card p-5 border-white/5 text-center space-y-1">
                                <div className="text-3xl font-bold text-orange-400">
                                    {user.expertise_areas?.length ?? 0}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">Interests</div>
                            </div>
                        </div>
                    </div>

                    {/* ORCID Integration */}
                    <div className="glass-card-heavy p-6 border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">ORCID Integration</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {user?.orcid_id
                                        ? `Connected: ${user.orcid_id}`
                                        : 'Connect your ORCID iD to sync publications'}
                                </p>
                            </div>
                            {user?.orcid_id ? (
                                <a
                                    href={`https://orcid.org/${user.orcid_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View ORCID
                                </a>
                            ) : (
                                <a
                                    href={`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/orcid/authorize`}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A6CE39]/10 border border-[#A6CE39]/20 text-[#A6CE39] text-xs font-semibold hover:bg-[#A6CE39]/20 transition-all"
                                >
                                    Connect ORCID
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Discovery Feed */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                            Trending in Your Field
                        </h3>
                        <DiscoveryFeed
                            careerField={careerField}
                            onSearch={onSearch}
                            topics={[]}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
