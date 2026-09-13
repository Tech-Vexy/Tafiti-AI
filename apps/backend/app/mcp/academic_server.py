"""
Tafiti Academic MCP Server
==========================
Exposes structured academic search, DOI lookup, and library tools
via the Model Context Protocol (MCP) for Gemini Deep Research.
"""
from typing import Optional, Any
from sqlalchemy import select

from mcp.server.mcpserver import MCPServer
from app.services.openalex_service import get_openalex_service
from app.db.session import AsyncSessionLocal
from app.models.database import UploadedFile
from app.core.logger import get_logger

logger = get_logger("academic_mcp")

academic_mcp = MCPServer("tafiti-academic-mcp")


@academic_mcp.tool(
    name="search_openalex_papers",
    description="Search OpenAlex for peer-reviewed academic papers with exact citation counts, open-access status, PDF links, and DOIs."
)
async def search_openalex_papers(
    query: str,
    limit: int = 5,
    year_min: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Search OpenAlex repository for academic literature."""
    logger.info(f"MCP tool search_openalex_papers: query='{query}', limit={limit}")
    openalex = get_openalex_service()
    filters = {}
    if year_min:
        filters["from_publication_date"] = f"{year_min}-01-01"
    
    try:
        papers = await openalex.search_papers(query=query, limit=min(limit, 15), filters=filters)
        return [
            {
                "id": p.id,
                "title": p.title,
                "doi": p.doi,
                "publication_year": p.publication_year,
                "citation_count": p.citation_count,
                "authors": p.authors,
                "abstract": p.abstract[:500] if p.abstract else None,
                "pdf_url": p.pdf_url,
                "is_open_access": p.is_open_access,
            }
            for p in papers
        ]
    except Exception as e:
        logger.error(f"MCP search_openalex_papers failed: {e}")
        return [{"error": str(e)}]


@academic_mcp.tool(
    name="lookup_doi",
    description="Look up full academic metadata and BibTeX citation for a given DOI (Digital Object Identifier)."
)
async def lookup_doi(doi: str) -> dict[str, Any]:
    """Resolve DOI into structured academic metadata and BibTeX."""
    logger.info(f"MCP tool lookup_doi: doi='{doi}'")
    openalex = get_openalex_service()
    clean_doi = doi.strip().replace("https://doi.org/", "").replace("http://doi.org/", "")
    work_id = f"https://doi.org/{clean_doi}"
    
    try:
        details = await openalex.get_paper_details(work_id)
        if not details:
            return {"error": f"DOI {doi} not found in academic database."}
        
        authors = [a.get("author", {}).get("display_name", "") for a in details.get("authorships", [])]
        year = details.get("publication_year", "")
        title = details.get("title", "")
        first_author_last = authors[0].split()[-1] if authors else "Author"
        bibtex_key = f"{first_author_last.lower()}{year}"
        bibtex = f"@article{{{bibtex_key},\n  title = {{{title}}},\n  author = {{{' and '.join(authors)}}},\n  year = {{{year}}},\n  doi = {{{clean_doi}}}\n}}"

        return {
            "title": title,
            "doi": clean_doi,
            "publication_year": year,
            "citation_count": details.get("cited_by_count", 0),
            "authors": authors,
            "bibtex": bibtex,
            "landing_page_url": details.get("doi"),
            "open_access_pdf": (details.get("open_access") or {}).get("oa_url"),
        }
    except Exception as e:
        logger.error(f"MCP lookup_doi failed: {e}")
        return {"error": str(e)}


@academic_mcp.tool(
    name="search_user_library",
    description="Search through user-uploaded research papers, extracted texts, and personal library."
)
async def search_user_library(query: str, user_id: str) -> list[dict[str, Any]]:
    """Search user uploaded papers and library."""
    logger.info(f"MCP tool search_user_library: query='{query}', user_id='{user_id}'")
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(UploadedFile).where(
                UploadedFile.user_id == user_id,
                UploadedFile.filename.ilike(f"%{query}%")
            ).limit(10)
            result = await db.execute(stmt)
            files = result.scalars().all()
            return [
                {
                    "id": f.id,
                    "filename": f.filename,
                    "file_size": f.file_size,
                    "uploaded_at": str(f.uploaded_at),
                }
                for f in files
            ]
    except Exception as e:
        logger.error(f"MCP search_user_library failed: {e}")
        return [{"error": str(e)}]
