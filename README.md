# Tafiti AI

A powerful, AI-powered research assistant integrated into a monorepo structure. This project combines modern React frontends with a robust FastAPI backend to provide deep research capabilities, semantic search, and synthesis.

## Features

- **Monorepo Architecture**: Managed with [Turborepo](https://turbo.build/repo) for efficient build and development workflows.
- **Frontend**: React, Vite, Tailwind CSS, Zustand, Clerk Authentication.
- **Landing Page**: Next.js, React, Framer Motion, Tailwind CSS.
- **Backend**: FastAPI, Agno, PostgreSQL, Qdrant Vector Database.
- **AI Integration**: Uses Groq/LLMs for synthesis, Google Gemini for deep research, and Arxiv for academic paper search.
- **Institutional Sandboxes**: Branded workspaces for universities and events with role-based access.
- **Micro-Bounties**: Financial and reputation bounties for paper reviews with Paystack integration.

## Project Structure

```
Tafiti-AI/
├── apps/
│   ├── backend/       # FastAPI server (@tafiti/backend)
│   ├── frontend/      # React application (@tafiti/frontend)
│   └── landing-page/  # Next.js landing page
├── packages/          # Shared libraries (optional)
├── package.json       # Root configuration
└── turbo.json         # Pipeline configuration
```

## Prerequisites

- **Node.js**: v18+ (Required for frontend, landing page, and Turbo)
- **Python**: v3.10+ (Required for backend)
- **PostgreSQL**: v14+ (Required for database)
- **Qdrant**: (Required for vector database)
- **Redis**: (Optional, for caching)

## Getting Started

### 1. Install Dependencies

Install Node.js dependencies from the root:

```bash
npm install
```

Install Python dependencies for the backend:

```bash
cd apps/backend
pip install -r requirements.txt
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

- **Backend**: Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your API keys (Groq, Google, Postgres, etc.).
- **Frontend**: Copy `apps/frontend/.env.example` to `apps/frontend/.env` and configure your Clerk keys.
- **Landing Page**: No environment variables required for basic functionality.

### 3. Start Development Server

You can run all applications simultaneously from the root:

```bash
npm run dev
# or
npx turbo dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **Landing Page**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

### 4. Build for Production

To build all applications:

```bash
npm run build
# or
npx turbo build
```

## Commands

| Command | Description |
|Args|Description|
|---|---|
| `npm run dev` | Start development servers for all apps |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run format` | Format code with Prettier |

## Documentation

For more specific details, please refer to the application READMEs:
- [Backend Documentation](apps/backend/README.md)
- [Frontend Documentation](apps/frontend/README.md)
- [Landing Page Documentation](apps/landing-page/README.md)
