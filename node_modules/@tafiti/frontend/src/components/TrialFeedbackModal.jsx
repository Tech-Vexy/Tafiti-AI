import React, { useState } from 'react';
import { Star, X, Sparkles, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../hooks/useToast';

const FEATURES = [
    { id: 'synthesis', label: 'Synthesis' },
    { id: 'chat', label: 'Research Chat' },
    { id: 'gap-analysis', label: 'Gap Analysis' },
    { id: 'notes', label: 'Notes' },
    { id: 'discover', label: 'Discover' },
];

const RECOMMEND_OPTIONS = ['Yes', 'Maybe', 'No'];

const TrialFeedbackModal = ({ onClose, onSubmitted }) => {
    const toast = useToast();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [favoriteFeature, setFavoriteFeature] = useState(null);
    const [improvementText, setImprovementText] = useState('');
    const [wouldRecommend, setWouldRecommend] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.warn('Please select a rating before submitting.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data } = await api.post('/feedback/trial', {
                rating,
                favorite_feature: favoriteFeature,
                improvement_text: improvementText || null,
                would_recommend: wouldRecommend?.toLowerCase() || null,
            });
            toast.success('Thank you for your feedback!');
            onSubmitted(data);
        } catch {
            toast.error('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
            <div className="glass-card-heavy w-full max-w-lg p-10 border-white/10 shadow-2xl animate-modal-in relative">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="text-center space-y-3 mb-10">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto">
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight">How was your experience?</h3>
                    <p className="text-sm text-slate-400 font-medium">Your trial has ended — help us improve Tafiti AI.</p>
                </div>

                <div className="space-y-8">
                    {/* Star Rating */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Overall Rating</label>
                        <div className="flex items-center justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform hover:scale-125"
                                >
                                    <Star
                                        className={`w-8 h-8 transition-colors ${
                                            star <= (hoverRating || rating)
                                                ? 'text-amber-400 fill-amber-400'
                                                : 'text-slate-600'
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Favorite Feature */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Favorite Feature</label>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {FEATURES.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFavoriteFeature(favoriteFeature === f.id ? null : f.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        favoriteFeature === f.id
                                            ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                                            : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Improvement Text */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">What should we improve?</label>
                        <textarea
                            value={improvementText}
                            onChange={(e) => setImprovementText(e.target.value)}
                            placeholder="Tell us what could be better..."
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 resize-none transition-colors"
                        />
                    </div>

                    {/* Would Recommend */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Would you recommend Tafiti AI?</label>
                        <div className="flex gap-3 justify-center">
                            {RECOMMEND_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setWouldRecommend(wouldRecommend === option ? null : option)}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                        wouldRecommend === option
                                            ? option === 'Yes'
                                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                                                : option === 'No'
                                                    ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                                                    : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                                            : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-500 font-bold hover:bg-white/10 hover:text-white transition-all"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 btn-primary py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrialFeedbackModal;
