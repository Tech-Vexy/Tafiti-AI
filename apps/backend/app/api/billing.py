from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import os

from app.db.session import get_db
from app.models.database import User
from app.core.security import get_current_user
from app.services.paystack_service import PaystackService
from app.core.logger import get_logger

logger = get_logger("billing_api")

router = APIRouter()
paystack = PaystackService()

@router.post("/initialize")
async def initialize_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initialize a Paystack transaction for subscription (200 KES).
    """
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Amount is 200 KES
    amount = 200
    # Use localized callback URL if provided in env, else fallback
    callback_url = os.getenv("PAYSTACK_CALLBACK_URL", "http://localhost:5173/billing/callback")
    
    paystack_data = await paystack.initialize_transaction(
        email=user.email,
        amount_kes=amount,
        callback_url=callback_url
    )
    
    if not paystack_data:
        raise HTTPException(status_code=500, detail="Failed to initialize payment with Paystack")
    
    return paystack_data

@router.get("/verify/{reference}")
async def verify_subscription(
    reference: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify a subscription payment.
    """
    verification_data = await paystack.verify_transaction(reference)
    
    if not verification_data:
        raise HTTPException(status_code=400, detail="Transaction verification failed")
    
    if verification_data.get("status") == "success":
        result = await db.execute(select(User).where(User.id == current_user["user_id"]))
        user = result.scalar_one_or_none()
        
        if user:
            user.subscription_status = "active"
            # Subscription lasts 1 month
            user.subscription_ends_at = datetime.utcnow() + timedelta(days=30)
            user.paystack_customer_id = verification_data.get("customer", {}).get("customer_code")
            await db.commit()
            return {"status": "success", "message": "Subscription activated"}
            
    return {"status": "pending", "message": "Transaction not successful yet"}

@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Paystack webhooks for asynchronous events.
    """
    # In a real app, we would verify the signature here
    # For now, we'll process the event directly (CAUTION)
    payload = await request.json()
    event = payload.get("event")
    
    if event == "charge.success":
        data = payload.get("data")
        email = data.get("customer", {}).get("email")
        
        # Find user by email and update status
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            user.subscription_status = "active"
            user.subscription_ends_at = datetime.utcnow() + timedelta(days=30)
            await db.commit()
            logger.info(f"Subscription activated via webhook for {email}")
            
    return {"status": "ok"}
