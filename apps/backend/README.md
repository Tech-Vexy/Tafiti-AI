# Tafiti AI Backend API

FastAPI backend for Tafiti AI — academic research, deep research, collaboration, billing, and discovery.

## Stack

- **API**: FastAPI (async) + Uvicorn/Gunicorn, auto OpenAPI docs
- **Auth**: Clerk-issued JWTs verified against the Clerk JWKS endpoint (no Clerk secret keys or SDK required)
- **Database**: PostgreSQL 14+ / Supabase / Neon with SQLAlchemy 2.0 async + pgvector
- **Cache / Queue**: Redis (Upstash) for caching, rate-limit state, and Celery broker
- **LLMs**: Gemini (Deep Research agent via Interactions API), Nvidia NIM, OpenRouter (Pydantic AI drafter/critic)
- **Agents**: agno agent framework (`deep_research_agent`), Pydantic AI model routing
- **Observability**: Prometheus `/metrics` + OpenTelemetry OTLP (both opt-in)
- **Storage**: Supabase Storage (PDF papers, thesis artifacts)
- **Payments**: Paystack (KES billing)

## Architecture

```
backend/
├── app/
│   ├── api/                # Route modules (auth, research, teams, collaboration, billing, ...)
│   ├── agents/             # agno agents (deep research, ...)
│   ├── core/               # config, security, cache, rate_limit, model_router, celery, tracing
│   ├── db/                 # SQLAlchemy async engine/session, migrations, seed
│   ├── models/             # SQLAlchemy models + Pydantic schemas
│   ├── services/           # external APIs, vector store, research engine, agent execution
│   └── workers/            # Celery tasks
├── alembic/                # Database migrations
├── tests/                  # async pytest suite (SQLite in-memory + mocked vector store)
└── main.py                 # FastAPI application entrypoint
```

## Features

- Clerk JWT verification (JWKS cached with async lock, issuer/audience validated)
- Adaptive in-memory/Redis rate limiting with per-token buckets (`X-RateLimit-*` headers)
- pgvector semantic search over saved queries and research artifacts
- Popular/academic paper search (OpenAlex, CORE, Elsevier/Scopus, Springer, arXiv)
- Gemini Deep Research agent + agno agent pipeline with checkpoints and state machine
- Collaboration: teams, shared queries, live canvas (WebSocket), ghost profiles, social discovery
- Deep-research answer caching keyed by user to prevent cross-tenant leaks
- Trial billing + Paystack subscriptions
- Liveness/readiness/health endpoints with external dependency probing

## Installation

### Prerequisites

- Python 3.12+
- PostgreSQL 14+ (with `pgvector` for vector features)
- Redis (or Upstash Redis)

### Setup

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
# source .venv/bin/activate           # Linux/macOS

pip install -r requirements.txt
```

Runtime dependencies only. Install dev/test extras with `requirements-dev.txt`.

### Environment

```bash
cp .env.example .env
# Fill in at minimum: DATABASE_URL, REDIS_URL, CLERK_DOMAIN, a GEMINI_API_KEY
```

### Database

```bash
# Apply migrations
alembic upgrade head

# Or, outside production, let the app auto-run init_db on startup
uvicorn main:app --reload
```

On startup the app runs pending Alembic migrations. In production a failed
migration aborts startup; outside production it falls back to `init_db()`
for local development.

## Usage

### Development

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Celery workers

```bash
celery -A app.core.celery_app worker --loglevel=info --concurrency=4
```

## Health & Observability

- `GET /health/live` — liveness (always 200 when process is up)
- `GET /ready` — readiness (DB + cache ping)
- `GET /health` — detailed status incl. external services with 120s probe cache
- `GET /metrics` — Prometheus metrics when `ENABLE_PROMETHEUS=true`
- OpenTelemetry traces when `OTEL_EXPORTER_OTLP_ENDPOINT` is set

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Testing

```bash
# From apps/backend
pytest tests/ -v
pytest tests/ --cov=app
```

Tests run against an in-memory SQLite database with the vector store mocked
(`conftest.py` stubs `app.services.vector_service`) and use `ASGITransport`
(no lifespan) so they do not touch Redis or external APIs. Lint with:

```bash
ruff check .
```

## Configuration

Key settings (see `.env.example` and `app/core/config.py` for the full list):

```ini
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/postgres?ssl=require
REDIS_URL=rediss://default:token@your-endpoint.upstash.io:6379
CLERK_DOMAIN=your-clerk-instance.clerk.accounts.dev
GEMINI_API_KEY=your_key
DEFAULT_LLM_PROVIDER=gemini
SECRET_KEY=<opaque 32+ char value; required and validated in production>
FRONTEND_URL=https://app.tafitiai.co.ke
```

Production startup fails fast with a clear error when `SECRET_KEY`,
`DATABASE_URL`, `OPENALEX_EMAIL`, `CLERK_DOMAIN`, or `GEMINI_API_KEY` are
missing or still at their dev defaults.

## Security

- Clerk JWT verification against live JWKS (no hardcoded fallback issuer)
- HMAC-signed deep-research cache keys scoped per user
- Rate limiting per authenticated token (localhost exempt only outside production)
- SQLAlchemy parameterized queries; CORS allow-list in `ALLOWED_ORIGINS`
- `SECRET_KEY` validated at startup in production
- Optional `CLERK_AUDIENCE` / `CLERK_ISSUER` / `CLERK_JWKS_URL` overrides

## License

MIT