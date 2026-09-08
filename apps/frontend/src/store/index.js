/**
 * Zustand Store
 * ==============
 * Centralised state management replacing the 1000+ line App.jsx state.
 *
 * Usage:
 *   import useUIStore from '../store';
 *   const { activeTab, setActiveTab } = useUIStore();
 *
 * Or import a specific slice:
 *   import useUserStore from '../store/useUserStore';
 */
export { default as useUIStore } from './useUIStore';
export { default as useUserStore } from './useUserStore';
export { default as useResearchStore } from './useResearchStore';
export { default as useLibraryStore } from './useLibraryStore';
