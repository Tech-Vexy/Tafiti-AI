from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, List
from pydantic import BaseModel
from datetime import datetime
import io
import pypdf

from app.db.session import get_db
from app.services.pinata_service import get_pinata_service
from app.core.security import get_current_user
from app.core.subscription import require_trial_or_active
from app.core.logger import get_logger
from app.models.database import UploadedFile

logger = get_logger("uploads_api")
router = APIRouter()

MAX_SIZE = 10 * 1024 * 1024  # 10 MB


class UploadHistoryItem(BaseModel):
    id: int
    filename: str
    cid: str | None = None
    file_size: int | None = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


@router.post("/pdf")
async def upload_research_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    _gate: dict = Depends(require_trial_or_active),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        content = await file.read()

        if len(content) > MAX_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB")

        # Validate PDF magic bytes (%PDF-)
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

        # 1. Extract Text
        text = ""
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")

        # 2. Upload to Pinata
        pinata = get_pinata_service()
        cid = await pinata.upload_file(content, file.filename)

        # 3. Record in DB
        record = UploadedFile(
            user_id=current_user["user_id"],
            filename=file.filename,
            cid=cid,
            file_size=len(content),
        )
        db.add(record)
        await db.commit()

        return {
            "filename": file.filename,
            "cid": cid,
            "extracted_text": text[:5000],
            "full_text_length": len(text),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await file.close()


@router.get("/history", response_model=List[UploadHistoryItem])
async def get_upload_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Return the current user's PDF upload history, newest first."""
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.user_id == current_user["user_id"])
        .order_by(desc(UploadedFile.uploaded_at))
        .limit(limit)
    )
    return result.scalars().all()
