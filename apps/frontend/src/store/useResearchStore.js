/**
 * Research State Slice
 * ---------------------
 * Manages search results, synthesis, research chat, and recommendations.
 */
import { create } from 'zustand';
import api from '../api/client';

const useResearchStore = create((set, get) => ({
  // Search
  papers: [],
  selectedPapers: [],
  lastQuery: '',
  isLoading: false,

  handleSearch: async (query, filters = null) => {
    set({ isLoading: true, lastQuery: query });
    try {
      const response = await api.post('/research/search', { query, filters });
      set({
        papers: response.data.papers,
        selectedPapers: response.data.papers,
        synthesis: '',
        recs: [],
      });
      return response.data.papers.length;
    } catch (error) {
      console.error('Search failed', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  togglePaper: (paper) =>
    set((s) => ({
      selectedPapers: s.selectedPapers.find((p) => p.id === paper.id)
        ? s.selectedPapers.filter((p) => p.id !== paper.id)
        : [...s.selectedPapers, paper],
    })),

  // Synthesis
  synthesis: '',
  synthesisLanguage: 'English',
  outputLanguage: 'English',
  isSynthesizing: false,
  followupQuestions: [],
  setOutputLanguage: (lang) => set({ outputLanguage: lang }),

  handleSynthesize: async (getToken, isCollaborative) => {
    const { selectedPapers, lastQuery, outputLanguage } = get();
    if (selectedPapers.length === 0) return;

    set({ isSynthesizing: true, synthesis: '', followupQuestions: [] });

    try {
      const token = await getToken();
      const endpoint = isCollaborative ? '/research/synthesize/collaborative' : '/research/synthesize/stream';
      const response = await fetch(`${api.defaults.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: lastQuery,
          papers: selectedPapers,
          output_language: outputLanguage,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                set({ synthesis: accumulated });
              }
            } catch (e) { /* ignore parse errors in stream */ }
          }
        }
      }

      set({ synthesisLanguage: outputLanguage });

      // Save to history
      await api.post('/queries/', {
        title: `Synthesis: ${lastQuery}`,
        query: lastQuery,
        papers: selectedPapers,
        answer: accumulated,
        tags: ['synthesis'],
      });

      return true;
    } catch (error) {
      console.error('Synthesis failed', error);
      throw error;
    } finally {
      set({ isSynthesizing: false });
    }
  },

  // Paper impact
  paperImpacts: {},
  isImpactLoading: {},
  handleGetPaperImpact: async (paperId) => {
    if (get().paperImpacts[paperId]) return;
    set((s) => ({ isImpactLoading: { ...s.isImpactLoading, [paperId]: true } }));
    try {
      const response = await api.post(`/research/papers/${paperId}/impact`);
      set((s) => ({ paperImpacts: { ...s.paperImpacts, [paperId]: response.data } }));
    } catch (e) {
      console.error('Failed to get paper impact', e);
    } finally {
      set((s) => ({ isImpactLoading: { ...s.isImpactLoading, [paperId]: false } }));
    }
  },

  // Research Chat
  messages: [],
  isChatLoading: false,
  isCollaborative: false,
  setIsCollaborative: (v) => set({ isCollaborative: v }),

  handleResearchChat: async (query, sourceIds, getToken, uploadedFiles) => {
    if (!query.trim()) return;

    const newUserMessage = { role: 'user', content: query };
    set((s) => ({
      messages: [...s.messages, newUserMessage],
      followupQuestions: [],
      isChatLoading: true,
    }));

    try {
      const response = await fetch(`${api.defaults.baseURL}/research/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          query,
          history: get().messages,
          source_ids: sourceIds,
          uploaded_text: uploadedFiles.map((f) => f.extracted_text).join('\n\n'),
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      set((s) => ({ messages: [...s.messages, { role: 'assistant', content: '' }] }));

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                set((s) => {
                  const msgs = [...s.messages];
                  msgs[msgs.length - 1].content = assistantMessage;
                  return { messages: msgs };
                });
              }
              if (parsed.followup) {
                set({ followupQuestions: parsed.followup });
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }
    } catch (error) {
      console.error('Research chat failed', error);
    } finally {
      set({ isChatLoading: false });
    }
  },

  // Recommendations
  recs: [],
  isFetchRecs: false,
  discoverPapers: [],
  isLoadingDiscover: false,

  handleFetchRecommendations: async (preferences) => {
    set({ isFetchRecs: true });
    try {
      await api.put('/auth/me', {
        career_field: preferences.career_field,
        expertise_areas: preferences.interests,
      });
      const response = await api.post('/research/recommendations', preferences);
      set({ recs: response.data, isFetchRecs: false });
      return true;
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      set({ isFetchRecs: false });
      return false;
    }
  },

  fetchDiscoverPapers: async () => {
    set({ isLoadingDiscover: true });
    try {
      const response = await api.get('/research/recommendations/papers');
      set({ discoverPapers: Array.isArray(response.data) ? response.data : [] });
    } catch (error) {
      console.error('Failed to fetch discover papers:', error);
      set({ discoverPapers: [] });
    } finally {
      set({ isLoadingDiscover: false });
    }
  },
}));

export default useResearchStore;
