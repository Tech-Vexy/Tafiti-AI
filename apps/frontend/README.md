# Tafiti AI — Frontend

Next.js (App Router) frontend for the Tafiti AI academic research assistant. Provides a research chat experience with streaming deep-research agents, live research tracking, citations/grounding, collaborative editing, library/history, billing, and profile management.

## Tech Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**
- **Clerk**: authentication (middleware protection + server-side token injection)
- **State**: Zustand stores (`research`, `library`, `UI`, `user`)
- **UI**: MUI v6 + Tailwind CSS + Radix primitives (shadcn-style)
- **Streaming**: `@microsoft/fetch-event-source` for SSE chat + AG-UI lifecycle events
- **Collab editing**: Yjs + WebSocket provider
- **Math rendering**: KaTeX + remark-math/rehype-katex

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/                # Routes (App Router)
│   │   ├── api/v1/[...path]/route.ts  # BFF proxy to the FastAPI backend
│   │   ├── proxy.ts        # Clerk middleware (route protection)
│   │   ├── (dashboard)/    # research, history, billing, profile
│   │   ├── auth/           # Clerk sign-in / sign-up
│   │   └── privacy/, terms/, manifest/, ...
│   ├── components/         # ResearchChatbot/, ui/, citations, layout, landing, ...
│   ├── hooks/              # useDashboard, useForm, useKeyboardShortcuts, ...
│   ├── lib/                # citationUtils, ag-ui, yjs-provider/binding, utils
│   ├── store/              # Zustand stores
│   ├── types/              # Shared TypeScript types
│   └── index.css, proxy.ts
├── public/                 # Static assets
├── next.config.mjs         # Security headers + CSP + remote image patterns
└── package.json
```

## Getting Started

From the **repo root** (this is an npm/pnpm workspace):

```bash
pnpm install
pnpm dev          # starts backend + frontend via Turborepo
```

Or run this app alone:

```bash
pnpm --filter @tafiti/frontend dev
```

The frontend expects the FastAPI backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). All calls are proxied through the BFF route at `/api/v1/*`, which injects the Clerk JWT server-side so secrets never reach the browser.

## Environment Variables

Copy `apps/frontend/.env.example` to `apps/frontend/.env.local`. The key variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (in the browser) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key |
| `CLERK_SECRET_KEY` | Clerk secret (used only by the BFF proxy) |
| `NEXT_PUBLIC_CLERK_*_URL` | Clerk route configuration |

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (`next build`) |
| `pnpm start` | Serve a production build |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |

## Testing

Vitest (with React Testing Library) is used for unit tests. Run once:

```bash
pnpm test
```

Watch mode: `pnpm test -- --watch`.

## Deployment

Deployment is handled by **Netlify** (see `netlify.toml`) with the Next.js build output (`apps/frontend/.next`). The Backend-for-Frontend proxy keeps the Clerk secret server-side.