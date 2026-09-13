/**
 * TypeScript type definitions for Tafiti AI frontend
 * Provides type safety across the application
 */

// ============================================
// Paper Types
// ============================================
export interface Paper {
  id: string;
  title: string;
  year?: number;
  citations?: number;
  abstract: string;
  authors: string[];
  source?: string;
  doi?: string;
  url?: string;
  landing_page_url?: string;
  journal?: string;
  is_oa?: boolean;
  open_access?: boolean;
}

export interface PaperSearchRequest {
  query: string;
  limit?: number;
  filters?: {
    min_year?: number;
    max_year?: number;
    min_citations?: number;
    require_abstract?: boolean;
  };
}

export interface PaperSearchResponse {
  papers: Paper[];
  total: number;
  from_cache: boolean;
}

// ============================================
// Synthesis Types
// ============================================
export interface SynthesisRequest {
  query: string;
  papers: Paper[];
  output_language?: string;
  provider?: string;
  model?: string;
}

export interface SynthesisResponse {
  answer: string;
  sources_used: number[];
  processing_time: number;
  followup_questions?: string[];
}

export interface ValidatedSynthesisResponse {
  answer: string;
  citations: CitationValidation[];
  flagged_count: number;
  overall_confidence: number;
  critique_summary: string;
  processing_time: number;
  sources_used: number[];
}

export interface CitationValidation {
  source_index: number;
  confidence: number;
  is_supported: boolean;
  issue?: string;
}

// ============================================
// User Types
// ============================================
export interface User {
  id: string;
  username: string;
  email: string;
  imageUrl?: string;
  university?: string;
  career_field?: string;
  expertise_areas?: string[];
  citation_count?: number;
  publications_count?: number;
  interest_score?: number;
  subscription_status: 'inactive' | 'trialing' | 'active' | 'expired';
  trial_ends_at?: string;
  subscription_ends_at?: string;
  notification_count?: number;
  has_given_feedback?: boolean;
  is_superuser?: boolean;
  created_at?: string;
}

export type UserProfile = User;

// ============================================
// Notification Types
// ============================================
export interface Notification {
  id: string;
  content: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  type: 'connection' | 'system';
}

// ============================================
// Research Chat Types
// ============================================
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ChatResearchRequest {
  query: string;
  history: ChatMessage[];
  source_ids?: string[];
  uploaded_text?: string;
  provider?: string;
  model?: string;
}

// ============================================
// Gap Analysis Types
// ============================================
export interface GapAnalysisRequest {
  papers: Paper[];
  research_context?: string;
}

export interface GapAnalysisResponse {
  gaps: ResearchGap[];
  summary: string;
  papers_analyzed: number;
  processing_time: number;
}

export interface ResearchGap {
  type: 'geographic' | 'methodological' | 'temporal' | 'demographic' | 'theoretical' | 'interdisciplinary';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

// ============================================
// Citation Graph Types
// ============================================
export interface CitationGraphResponse {
  seed: Paper;
  references: Paper[];
  cited_by: Paper[];
  total_cited_by_count: number;
  total_references_count: number;
}

// ============================================
// Paper Impact Types
// ============================================
export interface PaperImpactRequest {
  paper_id: string;
}

export interface PaperImpactResponse {
  paper_id: string;
  career_field: string;
  relevance_score: number;
  impact_summary: string;
  key_takeaway: string;
  practical_applications: string[];
  future_directions: string[];
}

// ============================================
// Notes Types
// ============================================
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SavedQuery {
  id: string;
  title: string;
  query: string;
  papers: Paper[];
  answer?: string;
  tags: string[];
  created_at: string;
}

// ============================================
// Billing Types
// ============================================
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    synthesis_per_month: number;
    papers_per_search: number;
    storage_mb: number;
  };
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  reference: string;
  created_at: string;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================
// Health Check Types
// ============================================
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  dependencies: Record<string, string>;
}

// ============================================
// Utility Types
// ============================================
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingStateWithMessage extends LoadingState {
  message?: string;
}

export type SortOrder = 'asc' | 'desc';

export type DateRange = {
  start: string;
  end: string;
};

export type FilterOptions = {
  search?: string;
  dateRange?: DateRange;
  tags?: string[];
  authors?: string[];
  sources?: string[];
};
