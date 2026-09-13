/**
 * User State Slice (TypeScript)
 * ------------------------------
 * Manages user profile (merged Clerk + backend), trial state, and notifications.
 */
import { create } from 'zustand';
import api from '@/app/api/client';

export interface UserProfile {
  id?: string;
  username?: string;
  email?: string;
  imageUrl?: string;
  university?: string;
  citation_count?: number;
  publications_count?: number;
  interest_score?: number;
  expertise_areas?: string[];
  career_field?: string;
  subscription_status?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  notification_count?: number;
  has_given_feedback?: boolean;
  is_superuser?: boolean;
  created_at?: string;
}

export interface UserState {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | ((prev: UserProfile | null) => UserProfile | null)) => void;
  clerkUser: any;
  setClerkUser: (user: any) => void;
  getMergedUser: () => UserProfile | null;
  getTrialState: () => { trialNotStarted: boolean; isTrialExpired: boolean; isPremiumBlocked: boolean };
  notifications: any[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  isStartingTrial: boolean;
  handleStartTrial: () => Promise<boolean>;
}

const useUserStore = create<UserState>((set, get) => ({
  // Raw backend profile
  userProfile: null,
  setUserProfile: (profile) =>
    set((s) => ({ userProfile: typeof profile === 'function' ? profile(s.userProfile) : profile })),

  // Clerk user reference (set by App after Clerk loads)
  clerkUser: null,
  setClerkUser: (user) => set({ clerkUser: user }),

  // Derived merged user (Clerk fields + backend fields)
  getMergedUser: () => {
    const { userProfile, clerkUser } = get();
    if (!userProfile && !clerkUser) return null;
    return {
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
      has_given_feedback: userProfile?.has_given_feedback || false,
      is_superuser: userProfile?.is_superuser || false,
      created_at: userProfile?.created_at,
    };
  },

  // Trial state (derived)
  getTrialState: () => {
    const user = get().getMergedUser();
    if (!user) return { trialNotStarted: true, isTrialExpired: false, isPremiumBlocked: true };
    const trialNotStarted = !user.subscription_status || user.subscription_status === 'inactive';
    const isTrialExpired =
      user.subscription_status === 'trialing' &&
      !!user.trial_ends_at &&
      new Date(user.trial_ends_at) < new Date();
    const isPremiumBlocked = (trialNotStarted || isTrialExpired) && !user.is_superuser;
    return { trialNotStarted, isTrialExpired, isPremiumBlocked };
  },

  // Notifications
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {
    try {
      const [notifResp, countResp] = await Promise.all([
        api.get('/social/notifications'),
        api.get('/social/notifications/unread-count'),
      ]);
      set({ notifications: notifResp.data, unreadCount: countResp.data.count });
    } catch (e: any) {
      console.error('[UserStore] Failed to fetch notifications:', e?.message || e);
    }
  },

  markNotificationRead: async (id: string) => {
    try {
      await api.put(`/social/notifications/${id}/read`);
      get().fetchNotifications();
      get().fetchUserProfile();
    } catch (e: any) {
      console.error('[UserStore] Failed to mark read:', e?.message || e);
    }
  },

  // Fetch user profile from backend
  fetchUserProfile: async () => {
    const { clerkUser } = get();
    if (!clerkUser) return;
    try {
      console.info('[UserStore] Fetching profile from backend...');
      const response = await api.get('/auth/me');
      set({ userProfile: response.data });
      console.info('[UserStore] Profile loaded successfully');
    } catch (e: any) {
      console.warn('[UserStore] Backend profile fetch failed, using Clerk data as fallback:', e?.message || e);
      const { userProfile } = get();
      if (!userProfile) {
        set({
          userProfile: {
            username: clerkUser.username || clerkUser.firstName,
            email: clerkUser.primaryEmailAddress?.emailAddress,
          },
        });
      }
    }
  },

  // Start trial
  isStartingTrial: false,
  handleStartTrial: async () => {
    set({ isStartingTrial: true });
    try {
      console.info('[UserStore] Starting trial...');
      const { data } = await api.post('/auth/start-trial');
      set({ userProfile: data });
      return true;
    } catch (e: any) {
      console.error('[UserStore] Failed to start trial:', e?.message || e);
      return false;
    } finally {
      set({ isStartingTrial: false });
    }
  },
}));

export default useUserStore;
