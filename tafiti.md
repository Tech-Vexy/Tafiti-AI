# Tafiti AI — Project Summary

**What it is:** An AI-powered academic research platform built for researchers across Africa. It searches global **and** African scholarly sources, synthesizes findings in 13 languages, and provides end-to-end research tooling — discovery, gap analysis, systematic review, and thesis writing.

## Tafiti AI Features (highlighted)

- **Multi-source scholarly search** across 9–10 providers: OpenAlex, Semantic Scholar, arXiv, CORE, Elsevier/Scopus, DOAJ, AJOL, AfricArxiv, Springer, plus optional Parallel search — all fanned out concurrently with dedup/merge, created "total paper" summaries.
- **AI Synthesis** — streaming synthesis of selected papers (standard, validated-with-critic, and collaborative modes) in **13 languages** (English, Kiswahili, French, Arabic, Español, Português, Hindi, Deutsch, 中文, Amharic, Yoruba, Hausa, Zulu), with follow-up questions.
- **Research Chat** — streaming conversational Q&A grounded in your papers/sources and uploaded PDFs.
- **Paper Intelligence** — per-paper impact scoring and interactive citation graphs.
- **Gap Analysis** — auto-detected research gaps with urgency ratings and suggested research questions.
- **Research Timeline** — trace how a field evolved: milestones, key papers, suggested reading.
- **Systematic Review** — PICO framing, suggested databases, screening criteria, paper screening, and PRISMA flow generation.
- **Deep Research / Research Intelligence** — multi-agent pipeline (agent + critic + validation agents) with question decomposition, claims, evidence, contradictions, checkpoints, pause/resume, crash recovery, execution & audit logs.
- **Research Teams** — spawn sub-agents, assign tasks, plan, and message within agent teams.
- **Thesis Studio** — full WYSIWYG editor (Syncfusion) with AI outline generation, section refinement, abstract suggestions, style checks, clarity/transitions/summarize/expand, bibliography & citations (APA, MLA, Chicago, Harvard, Vancouver, IEEE), version history + snapshots + restore, PDF export, and **real-time collaborative editing via Yjs CRDT**.
- **Personalized recommendations** — based on career field/expertise preferences, plus trending/discovery.
- **Library, Notes & History** — save papers, clip anything to research notes, revisit past searches.
- **PDF uploads** with text extraction for chat/synthesis context.
- **Billing & Plans** — 7-day free trial and Paystack subscriptions (200 KES/mo), webhook verification.
- **Social layer** — researcher connections, followers, notifications.
- **Ghost profiles** — claimable institutional researcher profiles (AfricArxiv-style).
- **Extras** — ORCID sync, PDF export, saved queries + vector search, feedback/testimonials.

## Frontend (`apps/frontend`)

- **Stack:** Next.js 15 (App Router, React 19), TypeScript + JSX, Tailwind CSS, Clerk auth, Zustand state, axios (with in-memory GET cache + transient retry), Radix UI, lucide-react, react-markdown, Syncfusion DocumentEditor + Yjs, `pnpm`.
- **Routes:** `/`, `/feed`, `/chat`, `/discover`, `/library`, `/gap-analysis`, `/thesis`, `/notes`, `/history`, `/research-review`, `/workspace`, `/billing`, `/profile`, `/support`, `/auth/*`.
- **Architecture:** page.tsx → feature View components (`FeedView`, `ResearchChat`, `DiscoveryFeed`, `DiscoverView`, `GapAnalysisView`, `ThesisEditor`, `ResearchReviewView` w/ Timeline + Systematic tabs, `NotesView`, `BillingView`, `WorkspaceView`) → stores (`useResearchStore`, `useLibraryStore`, `useUserStore`, `useUIStore`).
- **Shell/UX:** dashboard `layout.tsx` with grouped nav, responsive sidebar, ⌘K command palette, keyboard shortcuts, breadcrumbs, onboarding tour, toast system, trial & feedback modals, premium/trial gatekeeping on synthesis.

## Backend (`apps/backend`)

- **Stack:** Python FastAPI, async SQLAlchemy over PostgreSQL, Alembic migrations, Redis cache, pgvector, Supabase (storage + pg_cron jobs), httpx shared client.
- **API surface (v1):** auth (Clerk JWT, ORCID), research (search/synthesize/chat/gap-analysis/history/deep-research/impact/citation-graph/parallel), recommendations, saved queries + vector search, notes, uploads (PDF), billing (Paystack), social, ghost-profiles, PDF export, research intelligence (checkpoints, claims, evidence, tasks, workflows), agent teams, thesis (outline, writing assist, citations, collaboration, Yjs sync), research timeline + systematic review (both mounted under `/enhancement`).
- **Cross-cutting:** per-group rate limiting (slowapi + custom tiers), gzip, CORS, structured JSON logging with request IDs + slow/error telemetry, security headers, 500 handler that hides internals, `/health` reporting DB/Redis/vector-store/Supabase/external-provider status, and graceful-shutdown checkpointing of running research sessions.