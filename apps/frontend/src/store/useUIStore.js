/**
 * UI State Slice
 * ---------------
 * Manages navigation, modals, and transient UI state.
 */
import { create } from 'zustand';

// Tab-to-route mapping
const TAB_ROUTES = {
  feed: '/',
  chat: '/chat',
  discover: '/discover',
  library: '/library',
  'gap-analysis': '/gap-analysis',
  workspace: '/workspace',
  notes: '/notes',
  history: '/history',
  thesis: '/thesis',
  'research-review': '/research-review',
  billing: '/billing',
  profile: '/profile',
  support: '/support',
};

// Reverse: route-to-tab
const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
);

/** Derive activeTab from a URL pathname */
export const tabFromPathname = (pathname) => {
  if (!pathname) return 'feed';
  // Exact match
  if (ROUTE_TABS[pathname]) return ROUTE_TABS[pathname];
  // Check with trailing slash stripped
  const stripped = pathname.replace(/\/$/, '');
  if (ROUTE_TABS[stripped]) return ROUTE_TABS[stripped];
  return 'feed';
};

/** Get route for a tab */
export const routeForTab = (tab) => TAB_ROUTES[tab] || '/';

const useUIStore = create((set) => ({
  // Navigation — for components that don't have access to useNavigate
  activeTab: 'feed',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Set activeTab from URL (called by App on route change)
  syncTabFromPath: (pathname) => {
    const tab = tabFromPathname(pathname);
    set({ activeTab: tab });
  },

  // Citation graph modal
  graphPaper: null,
  setGraphPaper: (paper) => set({ graphPaper: paper }),

  // Trial feedback modal
  showFeedbackModal: false,
  setShowFeedbackModal: (show) => set({ showFeedbackModal: show }),

  // Preference form (discover view)
  showPreferenceForm: false,
  setShowPreferenceForm: (show) => set({ showPreferenceForm: show }),
}));

export default useUIStore;
