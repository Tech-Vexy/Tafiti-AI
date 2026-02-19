import httpx
import os
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("paystack_service")

class PaystackService:
    def __init__(self):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.base_url = "https://api.paystack.co"
        self.headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    async def initialize_transaction(self, email: str, amount_kes: int, callback_url: str) -> Optional[Dict[str, Any]]:
        """
        Initialize a Paystack transaction.
        Amount should be in KES. Paystack expect amount in 'kobo' equivalent (cents).
        For KES, we multiply by 100 to get the subunit.
        """
        url = f"{self.base_url}/transaction/initialize"
        payload = {
            "email": email,
            "amount": int(amount_kes * 100), # Paystack expects amount in subunits
            "currency": "KES",
            "callback_url": callback_url,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=self.headers, json=payload)
                data = response.json()
                
                if response.status_code == 200 and data.get("status"):
                    return data.get("data")
                else:
                    logger.error(f"Paystack initialization failed: {data}")
                    return None
        except Exception as e:
            logger.error(f"Error initializing Paystack transaction: {e}")
            return None

    async def verify_transaction(self, reference: str) -> Optional[Dict[str, Any]]:
        """
        Verify a Paystack transaction using its reference.
        """
        url = f"{self.base_url}/transaction/verify/{reference}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers)
                data = response.json()
                
                if response.status_code == 200 and data.get("status"):
                    return data.get("data")
                else:
                    logger.error(f"Paystack verification failed: {data}")
                    return None
        except Exception as e:
            logger.error(f"Error verifying Paystack transaction: {e}")
            return None
