/**
 * Library State Slice (TypeScript)
 * ---------------------------------
 * Manages saved queries, history, notes, and file uploads.
 */
import { create } from 'zustand';
import api, { invalidateCache } from '@/app/api/client';

export interface SavedPaper {
  id?: string;
  paper_id?: string;
  title: string;
  abstract?: string;
  authors?: string[];
  year?: number;
  citations?: number;
  journal?: string;
  doi?: string;
  url?: string;
}

export interface HistoryQuery {
  id: string;
  title: string;
  query: string;
  answer?: string;
  papers?: any[];
  tags?: string[];
  created_at?: string;
  isLive?: boolean;
}

export interface UploadedFile {
  filename: string;
  extracted_text?: string;
  storage_path?: string;
}

// ── Realtime Cross-tab Sync ──────────────────────────────────────────────────
const HISTORY_CHANNEL_NAME = 'tafiti_history_sync';

export interface HistoryBroadcastMessage {
  type: 'HISTORY_CREATED' | 'HISTORY_UPDATED' | 'HISTORY_DELETED' | 'HISTORY_REFRESH';
  item?: HistoryQuery;
  id?: string;
  updates?: Partial<HistoryQuery>;
}

export function broadcastHistoryEvent(msg: HistoryBroadcastMessage) {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(HISTORY_CHANNEL_NAME);
      bc.postMessage(msg);
      bc.close();
    } else {
      localStorage.setItem('tafiti_history_sync_event', JSON.stringify({ ...msg, _t: Date.now() }));
    }
  } catch (err) {
    console.debug('[HistorySync] Broadcast ignored:', err);
  }
}

export interface LibraryState {
  // Library
  library: SavedPaper[];
  fetchLibrary: () => Promise<void>;
  handleSavePaper: (paper: SavedPaper) => Promise<boolean>;

  // History
  history: HistoryQuery[];
  isHistoryLoading: boolean;
  fetchHistory: (force?: boolean) => Promise<void>;
  addOptimisticHistoryItem: (item: HistoryQuery, broadcast?: boolean) => void;
  updateHistoryItem: (id: string, updates: Partial<HistoryQuery>, broadcast?: boolean) => void;
  removeOptimisticHistoryItem: (id: string, broadcast?: boolean) => void;

  // File Uploads
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  handleUploadFile: (file: File) => Promise<boolean>;
  handleRemoveUpload: (index: number) => void;

  // Clip to notes
  handleClipPaper: (paper: SavedPaper) => Promise<boolean>;
  handleClipSynthesis: (answer: string, papers: SavedPaper[], lastQuery: string) => Promise<boolean>;
  handleClipGapNote: (note: { title: string; content: string; tags: string[] }) => Promise<boolean>;
}

const useLibraryStore = create<LibraryState>((set, get) => ({
  // Library (saved papers)
  library: [],
  fetchLibrary: async () => {
    try {
      console.info('[LibraryStore] Fetching saved papers library...');
      const response = await api.get('/queries/library/papers');
      set({ library: Array.isArray(response.data) ? response.data : [] });
      console.info(`[LibraryStore] Saved papers loaded: ${(response.data || []).length}`);
    } catch (e: any) {
      console.error('[LibraryStore] Failed to fetch library:', e?.message || e);
    }
  },

  handleSavePaper: async (paper: SavedPaper) => {
    try {
      console.info('[LibraryStore] Saving paper:', paper.title);
      await api.post('/queries/library/papers', paper);
      get().fetchLibrary();
      return true;
    } catch (e: any) {
      console.error('[LibraryStore] Failed to save paper:', e?.message || e);
      return false;
    }
  },

  // History
  history: [],
  isHistoryLoading: false,
  fetchHistory: async (force = false) => {
    if (force) {
      invalidateCache('/queries');
    }
    set({ isHistoryLoading: true });
    try {
      console.info('[LibraryStore] Fetching query history...');
      const response = await api.get('/queries');
      const items = Array.isArray(response.data) ? response.data : [];
      set((s) => {
        // Retain any currently live optimistic items that are not yet saved to backend
        const liveItems = s.history.filter((h) => h.isLive && !items.some((i: any) => i.id === h.id));
        return { history: [...liveItems, ...items] };
      });
      console.info(`[LibraryStore] History loaded successfully: ${items.length} queries`);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        set({ history: [] });
      } else {
        console.warn('[LibraryStore] Failed to fetch history:', e?.message || e);
      }
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  addOptimisticHistoryItem: (item: HistoryQuery, broadcast = true) => {
    set((s) => {
      const exists = s.history.some((h) => h.id === item.id);
      if (exists) {
        return {
          history: s.history.map((h) => (h.id === item.id ? { ...h, ...item } : h)),
        };
      }
      return {
        history: [item, ...s.history],
      };
    });
    if (broadcast) {
      broadcastHistoryEvent({ type: 'HISTORY_CREATED', item });
    }
  },

  updateHistoryItem: (id: string, updates: Partial<HistoryQuery>, broadcast = true) => {
    set((s) => ({
      history: s.history.map((h) => {
        if (h.id === id) {
          return { ...h, ...updates };
        }
        return h;
      }),
    }));
    if (broadcast) {
      broadcastHistoryEvent({ type: 'HISTORY_UPDATED', id, updates });
    }
  },

  removeOptimisticHistoryItem: (id: string, broadcast = true) => {
    set((s) => ({
      history: s.history.filter((h) => h.id !== id),
    }));
    if (broadcast) {
      broadcastHistoryEvent({ type: 'HISTORY_DELETED', id });
    }
  },

  // File uploads
  uploadedFiles: [],
  isUploading: false,

  handleUploadFile: async (file: File) => {
    set({ isUploading: true });
    try {
      console.info('[LibraryStore] Uploading document:', file.name);
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};

      const response = await fetch(`${api.defaults.baseURL}/uploads/pdf`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
      const data = await response.json();

      set((s) => ({
        uploadedFiles: [
          ...s.uploadedFiles,
          { filename: data.filename, extracted_text: data.extracted_text, storage_path: data.storage_path },
        ],
      }));
      console.info('[LibraryStore] Document uploaded successfully:', data.filename);
      return true;
    } catch (error: any) {
      console.error('[LibraryStore] Failed to upload document:', error?.message || error);
      return false;
    } finally {
      set({ isUploading: false });
    }
  },

  handleRemoveUpload: (index: number) => {
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((_, i) => i !== index) }));
  },

  // Clip to notes
  handleClipPaper: async (paper: SavedPaper) => {
    const primaryAuthor = paper.authors && paper.authors.length > 0 ? paper.authors[0] : 'Author';
    const content = `### ${paper.title}\n\n**Abstract:** ${paper.abstract || 'N/A'}\n\n**Citation:** ${primaryAuthor} et al. (${paper.year || 'n.d.'}). ${paper.title}.`;
    try {
      await api.post('/notes/', {
        title: `Clip: ${paper.title.slice(0, 50)}...`,
        content,
        tags: ['clip', 'paper'],
      });
      return true;
    } catch (e: any) {
      console.error('[LibraryStore] Failed to clip paper:', e?.message || e);
      return false;
    }
  },

  handleClipSynthesis: async (answer: string, papers: SavedPaper[], lastQuery: string) => {
    const sources = papers.map((p, i) => {
      const primaryAuthor = p.authors && p.authors.length > 0 ? p.authors[0] : 'Author';
      return `[${i + 1}] ${primaryAuthor} et al. (${p.year || 'n.d.'}). ${p.title}.`;
    }).join('\n');
    const content = `## Research Synthesis\n\n${answer}\n\n### Sources\n${sources}`;
    try {
      await api.post('/notes/', {
        title: `Clip: Synthesis - ${lastQuery.slice(0, 30)}...`,
        content,
        tags: ['clip', 'synthesis'],
      });
      return true;
    } catch (e: any) {
      console.error('[LibraryStore] Failed to clip synthesis:', e?.message || e);
      return false;
    }
  },

  handleClipGapNote: async ({ title, content, tags }: { title: string; content: string; tags: string[] }) => {
    try {
      await api.post('/notes/', { title, content, tags });
      return true;
    } catch (e: any) {
      console.error('[LibraryStore] Failed to save gap note:', e?.message || e);
      return false;
    }
  },
}));

// Initialize browser realtime sync listeners
if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(HISTORY_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const msg = event.data as HistoryBroadcastMessage;
        if (!msg) return;
        const store = useLibraryStore.getState();
        if (msg.type === 'HISTORY_CREATED' && msg.item) {
          store.addOptimisticHistoryItem(msg.item, false);
        } else if (msg.type === 'HISTORY_UPDATED' && msg.id && msg.updates) {
          store.updateHistoryItem(msg.id, msg.updates, false);
        } else if (msg.type === 'HISTORY_DELETED' && msg.id) {
          store.removeOptimisticHistoryItem(msg.id, false);
        } else if (msg.type === 'HISTORY_REFRESH') {
          store.fetchHistory(true);
        }
      };
    }
  } catch (e) {
    console.warn('[HistorySync] BroadcastChannel init failed', e);
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'tafiti_history_sync_event' && e.newValue) {
      try {
        const msg = JSON.parse(e.newValue) as HistoryBroadcastMessage;
        const store = useLibraryStore.getState();
        if (msg.type === 'HISTORY_CREATED' && msg.item) {
          store.addOptimisticHistoryItem(msg.item, false);
        } else if (msg.type === 'HISTORY_UPDATED' && msg.id && msg.updates) {
          store.updateHistoryItem(msg.id, msg.updates, false);
        } else if (msg.type === 'HISTORY_DELETED' && msg.id) {
          store.removeOptimisticHistoryItem(msg.id, false);
        } else if (msg.type === 'HISTORY_REFRESH') {
          store.fetchHistory(true);
        }
      } catch {}
    }
  });
}

export default useLibraryStore;

