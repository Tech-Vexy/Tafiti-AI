from fastapi import APIRouter, Depends, HTTPException, Request, Header
from app.core.timeutil import utcnow
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
import os
import hmac
import hashlib

from app.db.session import get_db
from app.models.database import PaymentTransaction, User
from app.core.security import get_current_user
from app.services.paystack_service import PaystackService
from app.core.logger import get_logger

logger = get_logger("billing_api")

router = APIRouter()
paystack = PaystackService()
SUBSCRIPTION_AMOUNT_KES = 200

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
    amount = SUBSCRIPTION_AMOUNT_KES
    # Use localized callback URL if provided in env, else fallback
    callback_url = os.getenv("PAYSTACK_CALLBACK_URL", "http://localhost:5173/billing/callback")
    
    paystack_data = await paystack.initialize_transaction(
        email=user.email,
        amount_kes=amount,
        callback_url=callback_url
    )
    
    if not paystack_data:
        raise HTTPException(status_code=500, detail="Failed to initialize payment with Paystack")

    reference = paystack_data.get("reference")
    if not reference:
        raise HTTPException(status_code=502, detail="Payment gateway returned no reference")
    db.add(PaymentTransaction(
        user_id=user.id,
        reference=reference,
        amount=amount * 100,
        currency="KES",
        status="initialized",
    ))
    await db.commit()
    
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
        transaction_result = await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.reference == reference)
        )
        transaction = transaction_result.scalar_one_or_none()
        if not transaction or transaction.user_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Payment reference does not belong to this account")
        if transaction.status == "completed":
            return {"status": "success", "message": "Subscription already activated"}

        result = await db.execute(select(User).where(User.id == current_user["user_id"]))
        user = result.scalar_one_or_none()

        customer = verification_data.get("customer") or {}
        amount = verification_data.get("amount")
        currency = verification_data.get("currency")
        email = customer.get("email")
        if (
            not user
            or not user.email
            or not email
            or email.casefold() != user.email.casefold()
            or amount != SUBSCRIPTION_AMOUNT_KES * 100
            or currency != "KES"
        ):
            raise HTTPException(status_code=400, detail="Transaction does not match this subscription")
        
        user.subscription_status = "active"
        user.subscription_ends_at = utcnow() + timedelta(days=30)
        user.paystack_customer_id = customer.get("customer_code")
        transaction.status = "completed"
        transaction.completed_at = utcnow()
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
    # Verify Paystack HMAC-SHA512 signature
    secret_key = os.getenv("PAYSTACK_SECRET_KEY", "")
    raw_body = await request.body()
    if not secret_key:
        logger.error("PAYSTACK_SECRET_KEY is not configured; rejecting webhook")
        raise HTTPException(status_code=503, detail="Payment webhook is not configured")
    if not x_paystack_signature:
        raise HTTPException(status_code=400, detail="Missing webhook signature")
    expected = hmac.new(
        secret_key.encode("utf-8"), raw_body, hashlib.sha512
    ).hexdigest()
    if not hmac.compare_digest(expected, x_paystack_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    payload = json.loads(raw_body)
    event = payload.get("event")
    
    if event == "charge.success":
        data = payload.get("data") or {}
        email = data.get("customer", {}).get("email")
        reference = data.get("reference")
        if (
            data.get("amount") != SUBSCRIPTION_AMOUNT_KES * 100
            or data.get("currency") != "KES"
            or not email
            or not reference
        ):
            raise HTTPException(status_code=400, detail="Invalid subscription transaction")
        
        transaction_result = await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.reference == reference)
        )
        transaction = transaction_result.scalar_one_or_none()
        if not transaction or transaction.status == "completed":
            return {"status": "ok"}

        result = await db.execute(select(User).where(
            User.id == transaction.user_id,
            User.email == email,
        ))
        user = result.scalar_one_or_none()
        
        if user:
            user.subscription_status = "active"
            user.subscription_ends_at = utcnow() + timedelta(days=30)
            transaction.status = "completed"
            transaction.webhook_event = payload.get("id") or payload.get("event")
            transaction.completed_at = utcnow()
            await db.commit()
            logger.info(f"Subscription activated via webhook for {email}")
            
    return {"status": "ok"}
