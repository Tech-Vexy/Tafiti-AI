import httpx
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("pinata_service")

class PinataService:
    def __init__(self):
        self.api_key = settings.PINATA_API_KEY
        self.api_secret = settings.PINATA_API_SECRET
        self.jwt = settings.PINATA_JWT
        self.base_url = "https://api.pinata.cloud/pinning/pinFileToIPFS"

    async def upload_file(self, file_content: bytes, filename: str) -> Optional[str]:
        """
        Uploads a file to Pinata IPFS and returns the CID.
        """
        if not (self.jwt or (self.api_key and self.api_secret)):
            logger.error("Pinata credentials not configured")
            return None

        headers = {}
        if self.jwt:
            headers["Authorization"] = f"Bearer {self.jwt}"
        else:
            headers["pinata_api_key"] = self.api_key
            headers["pinata_secret_api_key"] = self.api_secret

        try:
            async with httpx.AsyncClient() as client:
                files = {"file": (filename, file_content)}
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    files=files,
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                cid = data.get("IpfsHash")
                logger.info(f"File {filename} uploaded to Pinata IPFS. CID: {cid}")
                return cid
        except Exception as e:
            logger.error(f"Failed to upload to Pinata: {str(e)}")
            return None

def get_pinata_service() -> PinataService:
    return PinataService()
