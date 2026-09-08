/**
 * Library State Slice
 * --------------------
 * Manages saved queries, history, notes, and file uploads.
 */
import { create } from 'zustand';
import api from '../api/client';

const useLibraryStore = create((set, get) => ({
  // Library (saved papers)
  library: [],
  fetchLibrary: async () => {
    try {
      const response = await api.get('/queries/library/papers');
      set({ library: response.data });
    } catch (e) {
      console.error('Failed to fetch library', e);
    }
  },

  handleSavePaper: async (paper) => {
    try {
      await api.post('/queries/library/papers', paper);
      get().fetchLibrary();
      return true;
    } catch (e) {
      console.error('Failed to save paper', e);
      return false;
    }
  },

  // History
  history: [],
  isHistoryLoading: false,
  fetchHistory: async () => {
    set({ isHistoryLoading: true });
    try {
      const response = await api.get('/queries/');
      set({ history: response.data });
    } catch (e) {
      console.error('Failed to fetch history', e);
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  // File uploads
  uploadedFiles: [],
  isUploading: false,

  handleUploadFile: async (file, getToken) => {
    set({ isUploading: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${api.defaults.baseURL}/uploads/pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      set((s) => ({
        uploadedFiles: [
          ...s.uploadedFiles,
          { filename: data.filename, extracted_text: data.extracted_text, storage_path: data.storage_path },
        ],
      }));
      return true;
    } catch (error) {
      console.error('Failed to upload PDF', error);
      return false;
    } finally {
      set({ isUploading: false });
    }
  },

  handleRemoveUpload: (index) => {
    set((s) => ({ uploadedFiles: s.uploadedFiles.filter((_, i) => i !== index) }));
  },

  // Clip to notes
  handleClipPaper: async (paper) => {
    const content = `### ${paper.title}\n\n**Abstract:** ${paper.abstract}\n\n**Citation:** ${paper.authors[0]} et al. (${paper.year}). ${paper.title}.`;
    try {
      await api.post('/notes/', {
        title: `Clip: ${paper.title.slice(0, 50)}...`,
        content,
        tags: ['clip', 'paper'],
      });
      return true;
    } catch (e) {
      console.error('Failed to clip paper', e);
      return false;
    }
  },

  handleClipSynthesis: async (answer, papers, lastQuery) => {
    const sources = papers.map((p, i) => `[${i + 1}] ${p.authors[0]} et al. (${p.year}). ${p.title}.`).join('\n');
    const content = `## Research Synthesis\n\n${answer}\n\n### Sources\n${sources}`;
    try {
      await api.post('/notes/', {
        title: `Clip: Synthesis - ${lastQuery.slice(0, 30)}...`,
        content,
        tags: ['clip', 'synthesis'],
      });
      return true;
    } catch (e) {
      console.error('Failed to clip synthesis', e);
      return false;
    }
  },

  handleClipGapNote: async ({ title, content, tags }) => {
    try {
      await api.post('/notes/', { title, content, tags });
      return true;
    } catch (e) {
      console.error('Failed to save gap note', e);
      return false;
    }
  },
}));

export default useLibraryStore;
