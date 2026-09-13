/**
 * UI State Slice
 * ---------------
 * Manages navigation, modals, and transient UI state.
 */
import { create } from 'zustand';

// Tab-to-route mapping
const TAB_ROUTES: Record<string, string> = {
  feed: '/',
  research: '/research',
  history: '/history',
  billing: '/billing',
  profile: '/profile',
};

// Reverse: route-to-tab
const ROUTE_TABS: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
);

/** Derive activeTab from a URL pathname */
export const tabFromPathname = (pathname: string): string => {
  if (!pathname) return 'feed';
  // Exact match
  if (ROUTE_TABS[pathname]) return ROUTE_TABS[pathname];
  // Check with trailing slash stripped
  const stripped = pathname.replace(/\/$/, '');
  if (ROUTE_TABS[stripped]) return ROUTE_TABS[stripped];
  return 'feed';
};

/** Get route for a tab */
export const routeForTab = (tab: string): string => TAB_ROUTES[tab] || '/';

export interface UIState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  syncTabFromPath: (pathname: string) => void;
  graphPaper: any | null;
  setGraphPaper: (paper: any | null) => void;
  showFeedbackModal: boolean;
  setShowFeedbackModal: (show: boolean) => void;
  showPreferenceForm: boolean;
  setShowPreferenceForm: (show: boolean) => void;
}

const useUIStore = create<UIState>((set) => ({
  // Navigation — for components that don't have access to useNavigate
  activeTab: 'feed',
  setActiveTab: (tab: string) => set({ activeTab: tab }),

  // Set activeTab from URL (called by App on route change)
  syncTabFromPath: (pathname: string) => {
    const tab = tabFromPathname(pathname);
    set({ activeTab: tab });
  },

  // Citation graph modal
  graphPaper: null,
  setGraphPaper: (paper: any | null) => set({ graphPaper: paper }),

  // Trial feedback modal
  showFeedbackModal: false,
  setShowFeedbackModal: (show: boolean) => set({ showFeedbackModal: show }),

  // Preference form (discover view)
  showPreferenceForm: false,
  setShowPreferenceForm: (show: boolean) => set({ showPreferenceForm: show }),
}));

export default useUIStore;
