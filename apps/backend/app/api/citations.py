"""
Citations API — search user's saved papers and format citations.

Endpoints:
  GET  /citations/sources       — list user's saved papers (searchable)
  POST /citations/format        — format a list of papers in a citation style
  POST /citations/format-inline — format a single citation as inline text (Author, Year)
  POST /citations/bibliography  — generate a full bibliography from selected papers
  GET  /citations/styles        — list available citation styles
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, or_
from pydantic import BaseModel, Field
from typing import List, Optional
import re

from app.db.session import get_db
from app.models.database import SavedPaper
from app.core.security import get_current_user
from app.core.logger import get_logger

logger = get_logger("citations_api")
router = APIRouter()


# ---------------------------------------------------------------------------
# Citation styles and formatting
# ---------------------------------------------------------------------------

CITATION_STYLES = {
    "apa": {
        "label": "APA 7th Edition",
        "description": "American Psychological Association — common in social sciences",
    },
    "mla": {
        "label": "MLA 9th Edition",
        "description": "Modern Language Association — common in humanities",
    },
    "chicago": {
        "label": "Chicago 17th Edition",
        "description": "Chicago Manual of Style — author-date system",
    },
    "harvard": {
        "label": "Harvard",
        "description": "Harvard referencing — widely used in UK/Australian universities",
    },
    "vancouver": {
        "label": "Vancouver",
        "description": "Numbered style — common in biomedical sciences",
    },
    "ieee": {
        "label": "IEEE",
        "description": "Institute of Electrical and Electronics Engineers — numbered style",
    },
}


def _parse_authors(authors_raw) -> list:
    """Normalize authors from JSONB (could be list of strings or dicts)."""
    if not authors_raw:
        return []
    if isinstance(authors_raw, str):
        try:
            import json
            authors_raw = json.loads(authors_raw)
        except Exception:
            return [a.strip() for a in authors_raw.split(",") if a.strip()]
    if not isinstance(authors_raw, list):
        return []
    result = []
    for a in authors_raw:
        if isinstance(a, str):
            result.append(a.strip())
        elif isinstance(a, dict):
            name = a.get("display_name") or a.get("name") or a.get("author", {}).get("display_name", "")
            if name:
                result.append(name.strip())
    return result


def _get_last_name(full_name: str) -> str:
    """Extract last name from a full name string."""
    parts = full_name.strip().split()
    return parts[-1] if parts else full_name.strip()


def _get_initials(full_name: str) -> str:
    """Extract initials from a full name string."""
    parts = full_name.strip().split()
    if len(parts) < 2:
        return parts[0][0].upper() + "." if parts else ""
    return "".join(p[0].upper() + "." for p in parts if p)


def _format_apa(title: str, authors: list, year: int | None, citations: int | None = None, paper_id: str = "") -> str:
    """APA 7th: Author, A. A., & Author, B. B. (Year). Title. Source."""
    author_str = _format_authors_apa(authors)
    yr = f"({year})" if year else "(n.d.)"
    return f"{author_str} {yr}. {title}."


def _format_authors_apa(authors: list) -> str:
    """Format author list for APA: Last, F. M., Last, F. M., & Last, F. M."""
    if not authors:
        return "Unknown Author"
    formatted = [_last_first_amp(a) for a in authors]
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return f"{formatted[0]} & {formatted[1]}"
    if len(formatted) <= 20:
        return ", ".join(formatted[:-1]) + f", & {formatted[-1]}"
    # > 20 authors: first 19 ... last
    return ", ".join(formatted[:19]) + f", ... {formatted[-1]}"


def _last_first_amp(name: str) -> str:
    """Convert 'First Last' to 'Last, F. M.'"""
    parts = name.strip().split()
    if len(parts) < 2:
        return name.strip()
    last = parts[-1]
    initials = "".join(p[0].upper() + "." for p in parts[:-1] if p)
    return f"{last}, {initials}"


def _last_first(name: str) -> str:
    """Convert 'First Last' to 'Last, First'."""
    parts = name.strip().split()
    if len(parts) < 2:
        return name.strip()
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def _format_mla(title: str, authors: list, year: int | None, **_) -> str:
    """MLA 9th: Author. 'Title.' Year."""
    author_str = _format_authors_mla(authors)
    return f"{author_str} \"{title}.\" {year or 'n.d.'}."


def _format_authors_mla(authors: list) -> str:
    if not authors:
        return ""
    if len(authors) == 1:
        return _last_first(authors[0]) + "."
    if len(authors) == 2:
        return f"{_last_first(authors[0])}, and {authors[1]}."
    return f"{_last_first(authors[0])}, et al."


def _format_chicago(title: str, authors: list, year: int | None, **_) -> str:
    """Chicago author-date: Author, First. Year. 'Title.'"""
    author_str = ", ".join(_last_first(a) for a in authors) if authors else "Unknown Author"
    yr = year or "n.d."
    return f"{author_str}. {yr}. \"{title}.\""


def _format_harvard(title: str, authors: list, year: int | None, **_) -> str:
    """Harvard: Author, A.A. (Year) 'Title'."""
    author_str = ", ".join(f"{_get_last_name(a)}, {_get_initials(a)}" for a in authors) if authors else "Unknown Author"
    yr = year or "n.d."
    return f"{author_str} ({yr}) '{title}'."


def _format_vancouver(title: str, authors: list, year: int | None, citations: int | None = None, **_) -> str:
    """Vancouver: Author(s). Title. Year;vol:pages."""
    if authors:
        if len(authors) <= 6:
            author_str = ", ".join(authors)
        else:
            author_str = ", ".join(authors[:3]) + ", et al."
    else:
        author_str = "Unknown Author"
    return f"{author_str}. {title}. {year or 'n.d.'}."


def _format_ieee(title: str, authors: list, year: int | None, **_) -> str:
    """IEEE: A. B. Author, C. D. Author, and E. F. Author, 'Title,' Year."""
    if authors:
        formatted = []
        for a in authors:
            parts = a.strip().split()
            if len(parts) >= 2:
                initials = " ".join(p[0].upper() + "." for p in parts[:-1] if p)
                formatted.append(f"{initials} {parts[-1]}")
            else:
                formatted.append(a.strip())
        if len(formatted) <= 3:
            author_str = ", ".join(formatted[:-1]) + (f", and {formatted[-1]}" if len(formatted) > 1 else formatted[0])
        else:
            author_str = ", ".join(formatted[:3]) + ", et al."
    else:
        author_str = "Unknown Author"
    return f"{author_str}, \"{title},\" {year or 'n.d.'}."


FORMATTERS = {
    "apa": _format_apa,
    "mla": _format_mla,
    "chicago": _format_chicago,
    "harvard": _format_harvard,
    "vancouver": _format_vancouver,
    "ieee": _format_ieee,
}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CitationSource(BaseModel):
    """A paper from the user's library formatted for citation use."""
    id: str
    paper_id: str
    title: str
    authors: list
    year: Optional[int] = None
    citations: Optional[int] = 0
    abstract: Optional[str] = ""
    doi: Optional[str] = None
    created_at: Optional[str] = None


class FormatRequest(BaseModel):
    paper_ids: List[str] = Field(..., min_length=1, description="List of paper_id values from the user's library")
    style: str = Field(default="apa", description="Citation style: apa, mla, chicago, harvard, vancouver, ieee")


class FormatInlineRequest(BaseModel):
    paper_id: str = Field(..., description="The paper_id to format as an inline citation")
    style: str = Field(default="apa")


class BibliographyRequest(BaseModel):
    paper_ids: List[str] = Field(..., min_length=1)
    style: str = Field(default="apa")
    sort_by: str = Field(default="author", description="Sort order: author, year, title")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/sources", response_model=List[CitationSource])
async def search_sources(
    q: Optional[str] = Query(None, description="Search in title and authors"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the user's saved papers, optionally filtered by search query."""
    stmt = (
        select(SavedPaper)
        .where(SavedPaper.user_id == current_user["user_id"])
    )

    if q and q.strip():
        search = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                SavedPaper.title.ilike(search),
                SavedPaper.abstract.ilike(search),
            )
        )

    stmt = stmt.order_by(desc(SavedPaper.created_at)).limit(200)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        CitationSource(
            id=r.paper_id,
            paper_id=r.paper_id,
            title=r.title,
            authors=_parse_authors(r.authors),
            year=r.year,
            citations=r.citations,
            abstract=r.abstract,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/format")
async def format_citations(req: FormatRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Format a list of papers in the specified citation style."""
    if req.style not in FORMATTERS:
        raise HTTPException(status_code=400, detail=f"Unknown style '{req.style}'. Available: {list(FORMATTERS.keys())}")

    result = await db.execute(
        select(SavedPaper).where(
            SavedPaper.user_id == current_user["user_id"],
            SavedPaper.paper_id.in_(req.paper_ids),
        )
    )
    rows = result.scalars().all()

    formatter = FORMATTERS[req.style]
    citations = []
    for r in rows:
        authors = _parse_authors(r.authors)
        formatted = formatter(
            title=r.title,
            authors=authors,
            year=r.year,
            citations=r.citations,
            paper_id=r.paper_id,
        )
        citations.append({
            "paper_id": r.paper_id,
            "formatted": formatted,
            "inline": _format_inline(authors, r.year),
            "style": req.style,
        })

    return {"style": req.style, "count": len(citations), "citations": citations}


@router.post("/format-inline")
async def format_inline_citation(req: FormatInlineRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Format a single citation as inline text: (Author, Year) or Author (Year)."""
    result = await db.execute(
        select(SavedPaper).where(
            SavedPaper.user_id == current_user["user_id"],
            SavedPaper.paper_id == req.paper_id,
        )
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found in your library")

    authors = _parse_authors(paper.authors)
    inline = _format_inline(authors, paper.year)
    reference = FORMATTERS.get(req.style, _format_apa)(
        title=paper.title, authors=authors, year=paper.year, citations=paper.citations
    )

    return {
        "paper_id": req.paper_id,
        "inline": inline,
        "reference": reference,
        "style": req.style,
    }


@router.post("/bibliography")
async def generate_bibliography(req: BibliographyRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate a formatted bibliography from selected papers, sorted and ready to paste."""
    if req.style not in FORMATTERS:
        raise HTTPException(status_code=400, detail=f"Unknown style '{req.style}'")

    result = await db.execute(
        select(SavedPaper).where(
            SavedPaper.user_id == current_user["user_id"],
            SavedPaper.paper_id.in_(req.paper_ids),
        )
    )
    rows = result.scalars().all()

    formatter = FORMATTERS[req.style]
    entries = []
    for r in rows:
        authors = _parse_authors(r.authors)
        formatted = formatter(title=r.title, authors=authors, year=r.year, citations=r.citations)
        entries.append({
            "paper_id": r.paper_id,
            "text": formatted,
            "sort_key": (authors[0] if authors else "").lower(),
            "year": r.year or 0,
            "title": r.title.lower(),
        })

    # Sort
    if req.sort_by == "year":
        entries.sort(key=lambda e: (-e["year"], e["sort_key"]))
    elif req.sort_by == "title":
        entries.sort(key=lambda e: e["title"])
    else:
        entries.sort(key=lambda e: e["sort_key"])

    bibliography = "\n\n".join(e["text"] for e in entries)

    return {
        "style": req.style,
        "count": len(entries),
        "bibliography": bibliography,
        "entries": entries,
    }


@router.get("/styles")
async def list_citation_styles():
    """List all available citation styles."""
    return {"styles": CITATION_STYLES}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_inline(authors: list, year: int | None) -> str:
    """Format an inline citation: (Last, Year) for 1-2 authors, (Last et al., Year) for 3+."""
    yr = str(year) if year else "n.d."
    if not authors:
        return f"(Unknown, {yr})"
    if len(authors) == 1:
        return f"({_get_last_name(authors[0])}, {yr})"
    if len(authors) == 2:
        return f"({_get_last_name(authors[0])} & {_get_last_name(authors[1])}, {yr})"
    return f"({_get_last_name(authors[0])} et al., {yr})"
