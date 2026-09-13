# Tafiti AI

A powerful, AI-powered research assistant integrated into a monorepo structure. This project combines a modern Next.js frontend with a robust FastAPI backend to provide deep research capabilities, semantic search, and synthesis.

## Features

- **Monorepo Architecture**: Managed with [Turborepo](https://turbo.build/repo) for efficient build and development workflows.
- **Frontend**: Next.js (App Router), React 19, MUI + Tailwind CSS, Zustand, Clerk Authentication, KaTeX.
- **Backend**: FastAPI, Agno, PostgreSQL (Supabase/Neon), pgvector, SurrealDB, Redis, Celery.
- **AI Integration**: Uses Nvidia/OpenRouter LLMs for fast synthesis, Google Gemini for deep research, and Arxiv/OpenAlex/Springer/Elsevier for academic paper search.
- **Research workflow**: Streaming deep-research agents, literature synthesis, gap analysis, citation grounding, thesis editing with collaborative (Yjs) support.
- **Billing**: Paystack subscription management with usage tiers.

## Project Structure

```
Tafiti-AI/
├── apps/
│   ├── backend/       # FastAPI server (Python)
│   └── frontend/      # Next.js application
├── package.json       # Root configuration (npm workspaces)
└── turbo.json         # Pipeline configuration
```

## Prerequisites

- **Node.js**: v20+ (required for frontend and Turbo)
- **Python**: v3.12+ (required for backend)
- **PostgreSQL**: v14+ (required for database; pgvector extension for vector search)
- **Redis**: (optional, for caching and Celery)

## Getting Started

### 1. Install Dependencies

Install Node.js dependencies from the root (pnpm is the package manager; a `pnpm-lock.yaml` is committed):

```bash
pnpm install
```

Install Python dependencies for the backend (uv recommended; a `uv.lock` is provided):

```bash
cd apps/backend
uv sync           # or: pip install -r requirements.txt
```

### Developer setup (recommended)

Create an isolated Python environment for development to avoid modifying system Python:

```bash
cd apps/backend
python -m venv .venv
source .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

Run tests locally:

```bash
pytest -q
```

### 2. Configure Environment

You will need to set up environment variables for all applications.

- **Backend**: Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your API keys (Google, Postgres, etc.).
- **Frontend**: Copy `apps/frontend/.env.example` to `apps/frontend/.env` and configure your Clerk keys.

### 3. Start Development Server

You can run all applications simultaneously from the root:

```bash
pnpm dev
# or
npx turbo dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. Build for Production

To build all applications:

```bash
pnpm build
# or
npx turbo build
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development servers for all apps |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps |
| `pnpm format` | Format code with Prettier |

## Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:
- **Backend**: ruff lint, pytest, pyright typecheck (currently non-blocking while typing debt is paid down)
- **Frontend**: eslint lint, `tsc` typecheck, vitest tests, production build

## Documentation

For more specific details, please refer to the application READMEs:
- [Backend Documentation](apps/backend/README.md)
- [Frontend Documentation](apps/frontend/README.md)
