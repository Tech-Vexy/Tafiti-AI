"""
AJOL (African Journals Online) API client using the standardized BaseExternalClient.
Provides access to African scholarly journals via OAI-PMH.
"""

import httpx
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET
from datetime import datetime

from app.core.config import settings
from app.core.external_client import BaseExternalClient, ExternalAPIError
from app.models.schemas import PaperBase
from app.core.logger import get_logger

logger = get_logger("ajol")


class AJOLService(BaseExternalClient):
    """
    AJOL OAI-PMH client.
    No API key required.
    Provides access to African scholarly journals.
    """
    
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(
            base_url=settings.AJOL_OAI_URL,
            service_name="AJOL",
            timeout=20.0,
            max_retries=3,
            cache_ttl=3600,
            api_key=None,  # No API key required
            rate_limit_per_minute=10,  # Conservative rate limit for OAI-PMH
        )
        self._shared_client = client
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Use shared client if provided, otherwise use base client."""
        if self._shared_client:
            return self._shared_client
        return super().client
    
    def _parse_oai_record(self, record: ET.Element) -> Optional[PaperBase]:
        """Parse OAI-PMH record to PaperBase."""
        try:
            # Extract metadata
            metadata = record.find(".//{http://www.openarchives.org/OAI/2.0/}metadata")
            if metadata is None:
                return None
            
            # Get DC elements
            dc_ns = "{http://purl.org/dc/elements/1.1/}"
            
            title = metadata.findtext(f"{dc_ns}title", "").strip()
            if not title:
                return None
            
            # Get identifier as paper ID
            identifier = record.findtext(".//{http://www.openarchives.org/OAI/2.0/}identifier", "")
            paper_id = identifier.split(":")[-1] if identifier else ""
            
            # Abstract
            abstract = metadata.findtext(f"{dc_ns}description", "")[:1500]
            
            # Authors
            authors = []
            for i in range(1, 10):  # Try dc:creator, dc:creator1, dc:creator2, etc.
                author_elem = metadata.find(f"{dc_ns}creator{i}" if i > 1 else f"{dc_ns}creator")
                if author_elem is not None and author_elem.text:
                    authors.append(author_elem.text.strip())
                elif i == 1:
                    break  # No more creators
            
            # Year
            year = None
            date = metadata.findtext(f"{dc_ns}date", "")
            if date:
                try:
                    # Try to parse year from date string
                    year = int(str(date)[:4])
                except ValueError:
                    logger.debug(f"Failed to parse year from date: {date}")
            
            return PaperBase(
                id=f"ajol:{paper_id}",
                title=title,
                year=year,
                citations=0,  # OAI-PMH doesn't provide citation counts
                abstract=abstract,
                authors=authors[:5],
            )
        except Exception as e:
            logger.debug(f"Error parsing OAI record: {e}")
            return None
    
    async def search_papers(
        self,
        query: str,
        limit: int = 10
    ) -> List[PaperBase]:
        """
        Search AJOL for articles matching query using OAI-PMH.
        
        Args:
            query: Search query string
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "verb": "ListRecords",
            "metadataPrefix": "oai_dc",
            "set": "all",  # Get all journals
        }
        
        try:
            # OAI-PMH uses GET with XML response
            response = await self.client.get(
                self.base_url,
                params=params
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            
            # Define OAI namespace
            oai_ns = "{http://www.openarchives.org/OAI/2.0/}"
            
            papers = []
            for record in root.findall(f".//{oai_ns}record"):
                if len(papers) >= limit:
                    break
                
                paper = self._parse_oai_record(record)
                if paper and query.lower() in paper.title.lower():
                    papers.append(paper)
            
            logger.info(f"AJOL '{query}': {len(papers)} papers")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"AJOL search failed for '{query}': {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in AJOL search: {e}")
            return []
    
    async def get_recent_papers(
        self,
        limit: int = 20
    ) -> List[PaperBase]:
        """
        Get recent papers from AJOL.
        
        Args:
            limit: Maximum number of results
        
        Returns:
            List of PaperBase objects
        """
        params = {
            "verb": "ListRecords",
            "metadataPrefix": "oai_dc",
            "set": "all",
        }
        
        try:
            response = await self.client.get(
                self.base_url,
                params=params
            )
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            oai_ns = "{http://www.openarchives.org/OAI/2.0/}"
            
            papers = []
            for record in root.findall(f".//{oai_ns}record"):
                if len(papers) >= limit:
                    break
                
                paper = self._parse_oai_record(record)
                if paper:
                    papers.append(paper)
            
            logger.info(f"AJOL recent papers: {len(papers)} retrieved")
            return papers
            
        except ExternalAPIError as e:
            logger.warning(f"AJOL get_recent_papers failed: {e.message}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching recent papers: {e}")
            return []


# Singleton pattern for service instance
_ajol_singleton: Optional[AJOLService] = None

def get_ajol_service(client: Optional[httpx.AsyncClient] = None) -> AJOLService:
    """Get or create AJOL service instance."""
    global _ajol_singleton
    if client is not None:
        return AJOLService(client=client)
    if _ajol_singleton is None:
        _ajol_singleton = AJOLService()
    return _ajol_singleton
