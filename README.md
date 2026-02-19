# Tafiti AI

A powerful, AI-powered research assistant integrated into a monorepo structure. This project combines a modern React frontend with a robust FastAPI backend to provide deep research capabilities, semantic search, and synthesis.

## Features

- **Monorepo Architecture**: Managed with [Turborepo](https://turbo.build/repo) for efficient build and development workflows.
- **Frontend**: React, Vite, Tailwind CSS, Zustand.
- **Backend**: FastAPI, LangChain, ChromaDB, PostgreSQL.
- **AI Integration**: Uses Groq/LLMs for synthesis and OpenAlex for academic paper search.

## Project Structure

```
Tafiti-AI/
├── apps/
│   ├── backend/    # FastAPI server (@tafiti/backend)
│   └── frontend/   # React application (@tafiti/frontend)
├── packages/       # Shared libraries
├── package.json    # Root configuration
└── turbo.json      # Pipeline configuration
```

## Prerequisites

- **Node.js**: v18+ (Required for frontend and Turbo)
- **Python**: v3.10+ (Required for backend)
- **PostgreSQL**: v14+ (Required for database)
- **Redis**: (Optional, for caching)

## Getting Started

### 1. Install Dependencies

Install Node.js dependencies from the root:

```bash
npm install
```

### 2. Configure Environment

You will need to set up environment variables for both applications.

- **Backend**: Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your API keys (Groq, Postgres, etc.).
- **Frontend**: Create `apps/frontend/.env.local` if needed (see frontend README).

### 3. Start Development Server

You can run both the frontend and backend simultaneously from the root:

```bash
npm run dev
# or
npx turbo dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
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
