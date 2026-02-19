# Tafiti AI Backend API

Modern, modular FastAPI backend with vector database and agent framework.

## Architecture

```
backend/
├── app/
│   ├── api/              # API routes
│   │   ├── auth.py      # Authentication endpoints
│   │   ├── research.py  # Research & synthesis
│   │   └── queries.py   # Saved queries
│   ├── agents/          # LangChain agents
│   │   └── research_agent.py
│   ├── core/            # Core functionality
│   │   ├── config.py    # Configuration
│   │   └── security.py  # JWT & passwords
│   ├── db/              # Database
│   │   └── session.py   # SQLAlchemy async
│   ├── models/          # Data models
│   │   ├── database.py  # SQLAlchemy models
│   │   └── schemas.py   # Pydantic schemas
│   └── services/        # Business logic
│       ├── openalex_service.py
│       └── vector_service.py
└── main.py              # FastAPI application
```

## Features

- ⚡ **FastAPI**: Modern, fast, async API framework
- 🔐 **JWT Authentication**: Secure token-based auth
- 🗄️ **PostgreSQL + SQLAlchemy**: Async database operations
- 🧠 **LangChain**: Agent framework for LLM operations
- 📊 **ChromaDB**: Vector database for semantic search
- 🔍 **OpenAlex Integration**: Academic paper search
- 📡 **Streaming**: Server-sent events for real-time synthesis
- 📚 **Auto Documentation**: Swagger UI + ReDoc

## Installation

### Prerequisites

- Python 3.10+
- PostgreSQL 14+
- Redis (optional, for caching)

### Setup

1. **Create virtual environment**:
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Initialize database**:
```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE research_db;
\q
```

5. **Run migrations** (auto-creates tables on startup)

## Usage

### Development Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### With Gunicorn

```bash
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## API Documentation

Once running, access:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Authentication

```http
POST   /api/v1/auth/register    # Register new user
POST   /api/v1/auth/login        # Login
GET    /api/v1/auth/me           # Get current user
PUT    /api/v1/auth/me           # Update user
GET    /api/v1/auth/settings     # Get user settings
PUT    /api/v1/auth/settings     # Update settings
```

### Research

```http
POST   /api/v1/research/search           # Search papers
POST   /api/v1/research/synthesize       # Generate synthesis
POST   /api/v1/research/synthesize/stream # Streaming synthesis
GET    /api/v1/research/papers/{id}      # Get paper details
GET    /api/v1/research/papers/{id}/related # Related papers
```

### Saved Queries

```http
POST   /api/v1/queries/              # Create saved query
GET    /api/v1/queries/              # List saved queries
GET    /api/v1/queries/{id}          # Get query
PUT    /api/v1/queries/{id}          # Update query
DELETE /api/v1/queries/{id}          # Delete query
POST   /api/v1/queries/{id}/favorite # Toggle favorite
POST   /api/v1/queries/search        # Vector search
GET    /api/v1/queries/favorites/list # Get favorites
```

## Vector Database

ChromaDB is used for semantic search:

- **Embeddings**: sentence-transformers/all-MiniLM-L6-v2
- **Similarity**: Cosine distance
- **Features**: 
  - Semantic search across saved queries
  - Find similar research topics
  - Auto-suggest related queries

## Agent Framework

LangChain agents handle:

1. **Research Synthesis**: Combines papers into coherent answer
2. **Citation Management**: Proper inline citations [Source N]
3. **Key Concept Extraction**: Identifies main topics
4. **Follow-up Suggestions**: Recommends next research questions

## Configuration

Key settings in `.env`:

```ini
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/research_db

# LLM
GROQ_API_KEY=gsk_your_key_here
DEFAULT_LLM_PROVIDER=groq
DEFAULT_LLM_MODEL=llama3-70b-8192

# Vector DB
CHROMA_PERSIST_DIR=./chroma_db
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Security
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=app
```


## Performance

- **Async operations**: Non-blocking I/O
- **Connection pooling**: Database efficiency
- **Redis caching**: Fast repeated queries
- **Streaming**: Real-time user feedback
- **Vector search**: Sub-second semantic queries

## Security

- JWT token authentication
- Password hashing (bcrypt)
- CORS configuration
- Rate limiting
- SQL injection prevention (SQLAlchemy)
- XSS protection

## Monitoring

Health check endpoint:
```http
GET /health
```

Response:
```json
{
    "status": "healthy",
    "version": "2.0.0",
    "timestamp": 1708012345.67
}
```

## Troubleshooting

**Database connection error**:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -d research_db
```

**Vector database error**:
```bash
# Clear and reinitialize
rm -rf chroma_db/
# Restart application
```

**LLM errors**:
```bash
# Verify API keys
echo $GROQ_API_KEY

# Test connectivity
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/...
```

## License

MIT
