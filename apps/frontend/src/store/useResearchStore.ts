/**
 * Research State Slice (TypeScript)
 * ---------------------------------
 * Manages search results, synthesis, research chat, and recommendations.
 */
import { create } from 'zustand';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import api from '@/app/api/client';
import useLibraryStore from './useLibraryStore';
import useUserStore from './useUserStore';
import { extractAndStripSources } from '@/lib/citationUtils';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    try {
      const clerk = (window as any).Clerk;
      if (clerk?.session) {
        const token = await clerk.session.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn('[ResearchStore] Could not retrieve Clerk session token:', err);
    }
  }
  return headers;
}

export class FatalStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalStreamError';
  }
}

export class RetriableStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetriableStreamError';
  }
}

export interface Paper {
  id?: string;
  paper_id?: string;
  title: string;
  year?: number | null;
  abstract?: string;
  authors?: string[];
  author?: string;
  doi?: string | null;
  url?: string | null;
  pdf_url?: string | null;
  publisher?: string | null;
  source?: string | null;
  citations?: number;
  [key: string]: any;
}

export interface PipelineStep {
  id: string;
  label: string;
  status: string;
  elapsed_ms?: number;
  details?: any;
}

export interface ToolCall {
  tool: string;
  label: string;
  status: string;
  detail?: any;
  count?: number;
  durationMs?: number;
}

export interface ThoughtStep {
  signature: string;
  content: string;
  timestamp: number | string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string | number;
  sources?: Paper[];
  thoughtSteps?: ThoughtStep[];
  toolCalls?: ToolCall[];
  pipelineSteps?: PipelineStep[];
  citationClassifications?: Record<string, any>;
  mode?: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface ResearchStoreState {
  // Search
  papers: Paper[];
  selectedPapers: Paper[];
  lastQuery: string;
  isLoading: boolean;
  handleSearch: (query: string, filters?: any) => Promise<number>;
  togglePaper: (paper: Paper) => void;

  // Synthesis
  synthesis: string;
  synthesisLanguage: string;
  outputLanguage: string;
  isSynthesizing: boolean;
  followupQuestions: string[];
  setOutputLanguage: (lang: string) => void;
  handleSynthesize: (isCollaborative?: boolean) => Promise<boolean>;

  // Paper impact
  paperImpacts: Record<string, any>;
  isImpactLoading: Record<string, boolean>;
  handleGetPaperImpact: (paperId: string) => Promise<void>;

  // Research Modes & Latency
  researchMode: string;
  setResearchMode: (mode: string) => void;
  latencyMode: string;
  setLatencyMode: (mode: string) => void;

  // Precision Scoping & Domain Filters
  peerReviewedOnly: boolean;
  setPeerReviewedOnly: (v: boolean) => void;
  preprintsIncluded: boolean;
  setPreprintsIncluded: (v: boolean) => void;
  openAccessOnly: boolean;
  setOpenAccessOnly: (v: boolean) => void;
  domainScope: string;
  setDomainScope: (scope: string) => void;

  // Structured Matrix Extraction Schema
  matrixSchema: string[];
  toggleSchemaField: (field: string) => void;

  // Research Investigation State
  activeChatId: string | null;
  activeChatTitle: string;
  chatSources: Paper[];
  messages: ChatMessage[];
  isChatLoading: boolean;
  isCollaborative: boolean;
  selectedIndexes: string[];
  citationStyle: string;
  notifyOnComplete: boolean;

  toggleIndex: (key: string) => void;
  setSelectedIndexes: (indexes: string[]) => void;
  setCitationStyle: (style: string) => void;
  setIsCollaborative: (v: boolean) => void;
  setChatSources: (sources: Paper[]) => void;
  setNotifyOnComplete: (v: boolean) => void;

  startNewChat: () => void;
  loadChatSession: (historyItem: any) => void;
  deleteChatSession: (id: string) => Promise<boolean>;
  retryResearchChat: (errorIndex?: number) => Promise<void>;
  handleResearchChat: (
    query: string,
    explicitSourceIds?: string[],
    uploadedFiles?: any[],
    options?: { isRetry?: boolean; targetAssistantIdx?: number | null }
  ) => Promise<void>;

  // Recommendations
  recs: any[];
  isFetchRecs: boolean;
  discoverPapers: Paper[];
  isLoadingDiscover: boolean;
  handleFetchRecommendations: (preferences: any) => Promise<boolean>;
  fetchDiscoverPapers: () => Promise<void>;
}

const useResearchStore = create<ResearchStoreState>((set, get) => ({
  // Search
  papers: [],
  selectedPapers: [],
  lastQuery: '',
  isLoading: false,

  handleSearch: async (query: string, filters: any = null) => {
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

  togglePaper: (paper: Paper) =>
    set((s) => ({
      selectedPapers: s.selectedPapers.find((p) => (p.id || p.paper_id) === (paper.id || paper.paper_id))
        ? s.selectedPapers.filter((p) => (p.id || p.paper_id) !== (paper.id || paper.paper_id))
        : [...s.selectedPapers, paper],
    })),

  // Synthesis
  synthesis: '',
  synthesisLanguage: 'English',
  outputLanguage: 'English',
  isSynthesizing: false,
  followupQuestions: [],
  setOutputLanguage: (lang: string) => set({ outputLanguage: lang }),

  handleSynthesize: async (isCollaborative?: boolean) => {
    const { selectedPapers, lastQuery, outputLanguage } = get();
    if (selectedPapers.length === 0) return false;

    set({ isSynthesizing: true, synthesis: '', followupQuestions: [] });

    try {
      const synthTempId = `temp_synth_${Date.now()}`;
      useLibraryStore.getState().addOptimisticHistoryItem({
        id: synthTempId,
        title: `Synthesis: ${lastQuery.slice(0, 50)}`,
        query: lastQuery,
        answer: '',
        papers: selectedPapers,
        tags: ['synthesis'],
        created_at: new Date().toISOString(),
        isLive: true,
      });

      const endpoint = isCollaborative ? '/research/synthesize/collaborative' : '/research/synthesize/stream';
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${api.defaults.baseURL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          query: lastQuery,
          papers: selectedPapers,
          output_language: outputLanguage,
        }),
      });

      if (!response.body) {
        useLibraryStore.getState().updateHistoryItem(synthTempId, { isLive: false });
        return false;
      }

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

      // Save to history and update optimistic item in realtime
      try {
        const saveRes = await api.post('/queries/', {
          title: `Synthesis: ${lastQuery}`,
          query: lastQuery,
          papers: selectedPapers,
          answer: accumulated,
          tags: ['synthesis'],
        });
        if (saveRes?.data?.id) {
          useLibraryStore.getState().updateHistoryItem(synthTempId, {
            id: saveRes.data.id,
            title: saveRes.data.title || `Synthesis: ${lastQuery}`,
            answer: accumulated,
            papers: selectedPapers,
            created_at: saveRes.data.created_at || new Date().toISOString(),
            isLive: false,
          });
        } else {
          useLibraryStore.getState().updateHistoryItem(synthTempId, { isLive: false });
        }
      } catch (saveErr) {
        console.warn('Auto-saving synthesis session failed', saveErr);
        useLibraryStore.getState().updateHistoryItem(synthTempId, { isLive: false });
      }

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
  handleGetPaperImpact: async (paperId: string) => {
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

  // Research Modes & Latency
  researchMode: 'synthesis',
  setResearchMode: (mode: string) => set({ researchMode: mode }),
  latencyMode: 'deep',
  setLatencyMode: (mode: string) => set({ latencyMode: mode }),

  // Exa-style Precision Scoping & Domain Filters
  peerReviewedOnly: true,
  setPeerReviewedOnly: (v: boolean) => set({ peerReviewedOnly: v }),
  preprintsIncluded: true,
  setPreprintsIncluded: (v: boolean) => set({ preprintsIncluded: v }),
  openAccessOnly: false,
  setOpenAccessOnly: (v: boolean) => set({ openAccessOnly: v }),
  domainScope: 'all',
  setDomainScope: (scope: string) => set({ domainScope: scope }),

  // Exa-style Structured Matrix Extraction Schema
  matrixSchema: ['Methodology', 'Sample Size', 'Key Findings', 'Limitations'],
  toggleSchemaField: (field: string) =>
    set((s) => ({
      matrixSchema: s.matrixSchema.includes(field)
        ? s.matrixSchema.filter((f) => f !== field)
        : [...s.matrixSchema, field],
    })),

  // Research Investigation State
  activeChatId: null,
  activeChatTitle: '',
  chatSources: [],
  messages: [],
  isChatLoading: false,
  isCollaborative: false,
  selectedIndexes: ['openalex', 'ajol', 'africarxiv', 'semanticscholar', 'core'],
  citationStyle: 'apa',

  toggleIndex: (key: string) =>
    set((s) => ({
      selectedIndexes: s.selectedIndexes.includes(key)
        ? s.selectedIndexes.filter((k) => k !== key)
        : [...s.selectedIndexes, key],
    })),
  setSelectedIndexes: (indexes: string[]) => set({ selectedIndexes: indexes }),
  setCitationStyle: (style: string) => set({ citationStyle: style }),
  setIsCollaborative: (v: boolean) => set({ isCollaborative: v }),
  setChatSources: (sources: Paper[]) => set({ chatSources: sources }),
  notifyOnComplete: false,
  setNotifyOnComplete: (v: boolean) => set({ notifyOnComplete: v }),

  startNewChat: () =>
    set({
      activeChatId: null,
      activeChatTitle: '',
      messages: [],
      chatSources: [],
      followupQuestions: [],
      synthesis: '',
      isChatLoading: false,
    }),

  loadChatSession: (historyItem: any) => {
    if (!historyItem) return;
    let pastSources = historyItem.papers || [];
    if ((!pastSources || pastSources.length === 0) && historyItem.answer) {
      const { sources } = extractAndStripSources(historyItem.answer, []);
      pastSources = sources;
    }
    set({
      activeChatId: historyItem.id,
      activeChatTitle: historyItem.title || historyItem.query,
      chatSources: pastSources,
      selectedPapers: pastSources,
      papers: pastSources,
      lastQuery: historyItem.query,
      synthesis: historyItem.answer || '',
      messages: [
        { role: 'user', content: historyItem.query, timestamp: historyItem.created_at },
        {
          role: 'assistant',
          content: historyItem.answer,
          sources: pastSources,
          timestamp: historyItem.created_at,
        },
      ],
      followupQuestions: historyItem.followup || [],
      isChatLoading: false,
    });
  },

  deleteChatSession: async (id: string) => {
    // Instantly remove from history in library store across tabs
    useLibraryStore.getState().removeOptimisticHistoryItem(id);
    if (get().activeChatId === id) {
      get().startNewChat();
    }
    try {
      await api.delete(`/queries/${id}`);
      return true;
    } catch (err) {
      console.error('Failed to delete chat session:', err);
      // Re-sync on failure to restore accurate state
      useLibraryStore.getState().fetchHistory(true);
      return false;
    }
  },

  retryResearchChat: async (errorIndex?: number) => {
    const { messages } = get();
    let assistantIdx = typeof errorIndex === 'number' ? errorIndex : -1;
    if (assistantIdx < 0 || assistantIdx >= messages.length) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          assistantIdx = i;
          break;
        }
      }
    }
    if (assistantIdx < 0) return;

    let userQuery = '';
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content) {
        userQuery = messages[i].content;
        break;
      }
    }
    if (!userQuery) {
      userQuery = get().lastQuery || '';
    }
    if (!userQuery) return;

    await get().handleResearchChat(userQuery, [], [], {
      isRetry: true,
      targetAssistantIdx: assistantIdx,
    });
  },

  handleResearchChat: async (
    query: string,
    explicitSourceIds: string[] = [],
    uploadedFiles: any[] = [],
    options: { isRetry?: boolean; targetAssistantIdx?: number | null } = {}
  ) => {
    if (!query || !query.trim()) return;

    const { isRetry = false, targetAssistantIdx = null } = options || {};

    const files = uploadedFiles;

    const { messages, chatSources, researchMode, latencyMode, selectedIndexes, citationStyle } = get();
    let targetIdx = -1;

    if (isRetry) {
      if (typeof targetAssistantIdx === 'number' && targetAssistantIdx >= 0 && targetAssistantIdx < messages.length) {
        targetIdx = targetAssistantIdx;
      } else {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx >= 0) {
        set((s) => {
          const msgs = [...s.messages];
          msgs[targetIdx] = {
            role: 'assistant',
            content: '',
            sources: chatSources.length > 0 ? chatSources : [],
            thoughtSteps: [],
            toolCalls: [],
            pipelineSteps: [],
            citationClassifications: {},
            mode: researchMode,
            timestamp: new Date().toISOString(),
          };
          return {
            messages: msgs,
            followupQuestions: [],
            isChatLoading: true,
            lastQuery: query,
          };
        });
      }
    }

    if (targetIdx < 0) {
      const newUserMessage: ChatMessage = { role: 'user', content: query, timestamp: new Date().toISOString() };
      const newAssistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        sources: chatSources.length > 0 ? chatSources : [],
        thoughtSteps: [],
        toolCalls: [],
        pipelineSteps: [],
        citationClassifications: {},
        mode: researchMode,
        timestamp: new Date().toISOString(),
      };
      targetIdx = messages.length + 1;

      set((s) => ({
        messages: [
          ...s.messages,
          newUserMessage,
          newAssistantMessage,
        ],
        followupQuestions: [],
        isChatLoading: true,
        lastQuery: query,
      }));
    }

    let activePapers: Paper[] = chatSources.length > 0 ? [...chatSources] : [];
    if (activePapers.length === 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant' && messages[i].sources && messages[i].sources!.length > 0) {
          activePapers = [...(messages[i].sources!)];
          break;
        }
      }
    }
    const sourceIds = explicitSourceIds.length > 0
      ? explicitSourceIds
      : activePapers.map((p) => p.paper_id || p.id).filter(Boolean) as string[];

    // Realtime history tracking: create or activate optimistic history item immediately
    const existingChatId = get().activeChatId;
    const isNewSession = !existingChatId;
    const sessionTempId = existingChatId || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionTitle = query.slice(0, 60);

    if (isNewSession) {
      set({ activeChatId: sessionTempId, activeChatTitle: sessionTitle });
      useLibraryStore.getState().addOptimisticHistoryItem({
        id: sessionTempId,
        title: sessionTitle,
        query,
        answer: '',
        papers: activePapers,
        tags: [researchMode, 'academic_router'],
        created_at: new Date().toISOString(),
        isLive: true,
      });
    } else {
      useLibraryStore.getState().updateHistoryItem(existingChatId, {
        isLive: true,
      });
    }

    try {
      const headers = await getAuthHeaders();

      const endpoint = `${api.defaults.baseURL}/research/chat/stream`;
      let assistantMessage = '';
      let retryCount = 0;
      const maxRetries = 5;
      const initialRetryDelayMs = 1000;

      await fetchEventSource(endpoint, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          query,
          history: messages,
          papers: activePapers,
          source_ids: sourceIds,
          selected_indexes: selectedIndexes,
          research_mode: researchMode,
          latency_mode: latencyMode,
          citation_style: citationStyle,
          career_field: (get().domainScope && get().domainScope !== 'all') ? get().domainScope : (useUserStore.getState().userProfile?.career_field || undefined),
          uploaded_text: (files || []).map((f) => f.extracted_text || '').join('\n\n'),
        }),
        openWhenHidden: true,
        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            retryCount = 0;
            return;
          }
          let errDetail = `Server returned status ${response.status}`;
          try {
            const errData = await response.json();
            errDetail = errData.detail || errData.message || errDetail;
          } catch {
            // ignore parse errors
          }
          // 4xx client errors (401 Unauthorized, 400 Bad Request, 403 Forbidden) are fatal
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new FatalStreamError(errDetail);
          }
          // 5xx server errors or 429 Rate Limit can be retried
          throw new RetriableStreamError(errDetail);
        },
        onmessage(event) {
          retryCount = 0;
          const data = event.data;
          if (!data || data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const evType = parsed.type;

            // 1. Run Lifecycle Events
            if (evType === 'RUN_STARTED') {
              set({ isChatLoading: true });
            } else if (evType === 'RUN_FINISHED' || evType === 'RUN_ERROR') {
              set({ isChatLoading: false });
            }

            // 2. Step Lifecycle Events
            else if (evType === 'STEP_STARTED' || evType === 'STEP_FINISHED' || evType === 'pipeline_step') {
              set((s) => {
                const msgs = [...s.messages];
                const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                if (targetMsg && targetMsg.role === 'assistant') {
                  const steps = [...(targetMsg.pipelineSteps || [])];
                  const stepId = parsed.stepId || parsed.id || 'step';
                  const stepLabel = parsed.stepName || parsed.label || 'Executing Step';
                  const stepStatus = parsed.status || (evType === 'STEP_FINISHED' ? 'completed' : 'running');
                  const stepDuration = parsed.durationMs ?? parsed.elapsed_ms ?? 0;
                  const stepDetails = parsed.details || parsed.detail;

                  const existingIdx = steps.findIndex((step) => step.id === stepId);
                  const stepObj: PipelineStep = {
                    id: stepId,
                    label: stepLabel,
                    status: stepStatus,
                    elapsed_ms: stepDuration,
                    details: stepDetails,
                  };

                  if (existingIdx >= 0) {
                    steps[existingIdx] = { ...steps[existingIdx], ...stepObj };
                  } else {
                    steps.push(stepObj);
                  }
                  targetMsg.pipelineSteps = steps;
                }
                return { messages: msgs };
              });
            }

            // 3. Reasoning Events
            else if (evType === 'REASONING_MESSAGE_CONTENT' || evType === 'thought') {
              set((s) => {
                const msgs = [...s.messages];
                const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                if (targetMsg && targetMsg.role === 'assistant') {
                  const thoughts = [...(targetMsg.thoughtSteps || [])];
                  thoughts.push({
                    signature: parsed.signature || 'Research Reasoning',
                    content: parsed.content || '',
                    timestamp: parsed.timestamp || Date.now(),
                  });
                  targetMsg.thoughtSteps = thoughts;
                }
                return { messages: msgs };
              });
            }

            // 4. Tool Call Events
            else if (evType === 'TOOL_CALL_START' || evType === 'TOOL_CALL_RESULT' || evType === 'tool_call') {
              set((s) => {
                const msgs = [...s.messages];
                const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                if (targetMsg && targetMsg.role === 'assistant') {
                  const tools = [...(targetMsg.toolCalls || [])];
                  const toolKey = parsed.tool || parsed.toolCallId || 'tool';
                  const existingIdx = tools.findIndex((t) => (t.tool === toolKey));
                  const toolObj: ToolCall = {
                    tool: toolKey,
                    label: parsed.label || toolKey,
                    status: parsed.status || (evType === 'TOOL_CALL_RESULT' ? 'completed' : 'running'),
                    detail: parsed.detail,
                    count: parsed.count,
                    durationMs: parsed.durationMs,
                  };

                  if (existingIdx >= 0) {
                    tools[existingIdx] = { ...tools[existingIdx], ...toolObj };
                  } else {
                    tools.push(toolObj);
                  }
                  targetMsg.toolCalls = tools;
                }
                return { messages: msgs };
              });
            }

            // 5. AG-UI Custom Extension Events
            else if (evType === 'CUSTOM') {
              const name = parsed.name;
              if (name === 'sources') {
                activePapers = parsed.sources || [];
                set((s) => {
                  const msgs = [...s.messages];
                  const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                  if (targetMsg && targetMsg.role === 'assistant') {
                    targetMsg.sources = activePapers;
                  }
                  return {
                    messages: msgs,
                    papers: activePapers,
                    chatSources: activePapers,
                  };
                });
                // Update live history item's sources in real-time
                useLibraryStore.getState().updateHistoryItem(sessionTempId, {
                  papers: activePapers,
                }, false);
              } else if (name === 'citation_classification') {
                set((s) => {
                  const msgs = [...s.messages];
                  const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                  if (targetMsg && targetMsg.role === 'assistant') {
                    const classifications = { ...(targetMsg.citationClassifications || {}) };
                    classifications[parsed.index] = parsed;
                    targetMsg.citationClassifications = classifications;
                  }
                  return { messages: msgs };
                });
              } else if (name === 'followup') {
                set({ followupQuestions: parsed.followup || [] });
              }
            }

            // 6. Text Message Stream Events
            else if (evType === 'TEXT_MESSAGE_CONTENT' || evType === 'content' || parsed.content) {
              assistantMessage += parsed.content || '';
              set((s) => {
                const msgs = [...s.messages];
                const targetMsg = (targetIdx >= 0 && targetIdx < msgs.length) ? msgs[targetIdx] : msgs[msgs.length - 1];
                if (targetMsg && targetMsg.role === 'assistant') {
                  targetMsg.content = assistantMessage;
                  targetMsg.sources = activePapers;
                }
                return { messages: msgs };
              });
            }
            // 7. Follow-Up Questions
            else if (parsed.type === 'followup' || parsed.followup) {
              set({ followupQuestions: parsed.followup || [] });
            }
          } catch (e) {
            /* ignore parse errors on partial JSON chunks */
          }
        },
        onerror(err) {
          // 1. If it's a non-retriable error (FatalStreamError or AbortError), throw immediately to terminate
          if (err instanceof FatalStreamError || err.name === 'AbortError') {
            throw err;
          }

          // 2. Check against max retries limit
          if (retryCount >= maxRetries) {
            console.error(`[Tafiti Stream] Max retries (${maxRetries}) reached. Terminating stream.`);
            throw new FatalStreamError('Exceeded maximum retry attempts.');
          }

          // 3. Increment retry count and calculate custom exponential backoff delay
          retryCount++;
          const delay = Math.min(initialRetryDelayMs * Math.pow(2, retryCount - 1), 16000);
          console.warn(`[Tafiti Stream] Connection dropped. Retrying (${retryCount}/${maxRetries}) in ${delay}ms...`);

          // Return delay in ms to instruct @microsoft/fetch-event-source to delay retry
          return delay;
        },
      });

      // Auto-save investigation session and update realtime history record
      if (assistantMessage && assistantMessage.trim().length >= 20) {
        try {
          const sanitizedPapers = (activePapers || []).map((p, idx) => ({
            id: String(p?.id || p?.doi || p?.url || `paper-${idx}`),
            title: p?.title || 'Untitled Research',
            year: typeof p?.year === 'number' ? p.year : (parseInt(p?.year ?? '', 10) || null),
            abstract: p?.abstract || '',
            authors: Array.isArray(p?.authors) ? p.authors : (p?.author ? [p.author] : []),
            doi: p?.doi || null,
            url: p?.url || null,
            pdf_url: p?.pdf_url || null,
            publisher: p?.publisher || null,
            source: p?.source || null,
            citations: typeof p?.citations === 'number' ? p.citations : 0,
          }));

          const confirmedChatId = get().activeChatId;

          if (confirmedChatId && !confirmedChatId.startsWith('temp_')) {
            try {
              await api.put(`/queries/${confirmedChatId}`, {
                answer: assistantMessage,
                papers: sanitizedPapers,
              });
            } catch (putErr) {
              console.warn('[Tafiti] Failed to update existing thread query via PUT:', putErr);
            }
            useLibraryStore.getState().updateHistoryItem(confirmedChatId, {
              answer: assistantMessage,
              papers: sanitizedPapers,
              isLive: false,
            });
          } else {
            const saveRes = await api.post('/queries/', {
              title: sessionTitle,
              query,
              papers: sanitizedPapers,
              answer: assistantMessage,
              tags: [researchMode, 'academic_router'],
            });
            if (saveRes?.data?.id) {
              const confirmedId = String(saveRes.data.id);
              const confirmedTitle = saveRes.data.title || sessionTitle;
              set({ activeChatId: confirmedId, activeChatTitle: confirmedTitle });
              useLibraryStore.getState().updateHistoryItem(sessionTempId, {
                id: confirmedId,
                title: confirmedTitle,
                query,
                answer: assistantMessage,
                papers: sanitizedPapers,
                created_at: saveRes.data.created_at || new Date().toISOString(),
                isLive: false,
              });
            } else {
              useLibraryStore.getState().updateHistoryItem(sessionTempId, { isLive: false });
            }
          }
        } catch (saveErr) {
          console.warn('Auto-saving research session failed', saveErr);
          useLibraryStore.getState().updateHistoryItem(sessionTempId, { isLive: false });
        }
      } else {
        useLibraryStore.getState().updateHistoryItem(sessionTempId, { isLive: false });
      }
    } catch (error: any) {
      console.error('Research investigation failed', error);
      useLibraryStore.getState().updateHistoryItem(sessionTempId, { isLive: false });
      const errMsg = error?.message || 'Unable to complete research inquiry';
      set((s) => {
        const msgs = [...s.messages];
        const errSlot = (targetIdx >= 0 && targetIdx < msgs.length) ? targetIdx : msgs.length - 1;
        if (errSlot >= 0 && msgs[errSlot]) {
          msgs[errSlot] = {
            role: 'assistant',
            content: '',
            isError: true,
            errorMessage: errMsg,
            sources: [],
            pipelineSteps: [],
            toolCalls: [],
            thoughtSteps: [],
            timestamp: new Date().toISOString(),
          };
        }
        return { messages: msgs };
      });
    } finally {
      const state = get();
      if (state.notifyOnComplete && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Tafiti Research Complete', {
            body: `Your research synthesis on "${query.slice(0, 70)}" is ready.`,
            icon: '/favicon.ico',
          });
        } catch (notifErr) {
          console.warn('Failed to dispatch desktop notification:', notifErr);
        }
      }
      set({ isChatLoading: false });
    }
  },

  // Recommendations
  recs: [],
  isFetchRecs: false,
  discoverPapers: [],
  isLoadingDiscover: false,

  handleFetchRecommendations: async (preferences: any) => {
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
