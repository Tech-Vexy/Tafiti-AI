from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import io
import pypdf
import tempfile
import os
import asyncio
from google import genai

from app.db.session import get_db
from app.services.supabase_storage import upload_file as supabase_upload, get_signed_url
from app.core.security import get_current_user
from app.core.subscription import require_trial_or_active
from app.core.logger import get_logger
from app.core.config import settings
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

    model_config = ConfigDict(from_attributes=True)


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

        # 1. Extract Text and Summarize using Gemini API
        text = ""
        summary = ""
        try:
            if settings.GOOGLE_API_KEY:
                client = genai.Client(api_key=settings.GOOGLE_API_KEY, http_options={'api_version': 'v1alpha'})

                # Write to temp file to upload via Files API
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name

                try:
                    # Upload to Gemini asynchronously to not block the server thread
                    uploaded_file = await client.aio.files.upload(file=tmp_path, config={'mime_type': 'application/pdf'})

                    # Wait for processing if necessary
                    file_info = await client.aio.files.get(name=uploaded_file.name)
                    while file_info.state == "PROCESSING":
                        logger.info(f"File {uploaded_file.name} is processing...")
                        await asyncio.sleep(2)
                        file_info = await client.aio.files.get(name=uploaded_file.name)

                    if file_info.state == "FAILED":
                        raise Exception("Gemini file processing failed")

                    try:
                        # As requested by the user, we should use gemini-3.5-flash as it is the latest flash series model.
                        # Wait for processing if necessary (we did it above but the actual model call is here)

                        # Note: We must use the Interactions API for document processing as per the new beta docs
                        # for model gemini-3.5-flash. The API expects an 'interactions.create' not 'models.generate_content'.
                        interaction = await client.aio.interactions.create(
                            model="gemini-3.5-flash",
                            input=[
                                {"type": "document", "uri": uploaded_file.uri, "mime_type": uploaded_file.mime_type},
                                {"type": "text", "text": "Extract the full text and summarize this document. Please provide the summary first, followed by the extracted text."}
                            ]
                        )
                        part_text = interaction.output_text
                        if not part_text:
                            outputs = getattr(interaction, "outputs", None)
                            if outputs and getattr(outputs[-1], "text", None):
                                part_text = outputs[-1].text
                            else:
                                steps = getattr(interaction, "steps", None) or []
                                for step in reversed(steps):
                                    parts = getattr(step, "content", None) or []
                                    texts = [p.text for p in parts if getattr(p, "type", None) == "text" and getattr(p, "text", None)]
                                    if texts:
                                        part_text = "\n".join(texts)
                                        break
                        text = part_text or ""

                    finally:
                        # Best practice: Delete remote file after extraction
                        await client.aio.files.delete(name=uploaded_file.name)

                    # Also try to extract pure text using pypdf as fallback/addition
                    try:
                        pypdf_text = ""
                        reader = pypdf.PdfReader(io.BytesIO(content))
                        for page in reader.pages:
                            pypdf_text += page.extract_text() + "\n"
                        if not text:
                            text = pypdf_text
                    except Exception as e:
                        pass
                finally:
                    os.unlink(tmp_path)
            else:
                # Fallback to pure pypdf if no API key
                reader = pypdf.PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    text += page.extract_text() + "\n"

        except Exception as e:
            logger.error(f"Gemini extraction failed: {str(e)}")
            # Fallback to pure pypdf if Gemini fails
            try:
                reader = pypdf.PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            except Exception as e2:
                logger.error(f"Fallback Text extraction failed: {str(e2)}")

        # 2. Upload to Supabase Storage
        storage_path = await supabase_upload(
            file_content=content,
            filename=file.filename,
            user_id=current_user["user_id"],
        )

        # 3. Record in DB
        record = UploadedFile(
            user_id=current_user["user_id"],
            filename=file.filename,
            cid=storage_path,  # Supabase Storage path (replaces IPFS CID)
            file_size=len(content),
        )
        db.add(record)
        await db.commit()

        return {
            "filename": file.filename,
            "storage_path": storage_path,
            "extracted_text": text[:5000],
            "full_text_length": len(text),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")
    finally:
        await file.close()


@router.get("/history", response_model=List[UploadHistoryItem])
async def get_upload_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Return the current user's PDF upload history, newest first."""
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.user_id == current_user["user_id"])
        .order_by(desc(UploadedFile.uploaded_at))
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a signed download URL for an uploaded file."""
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.user_id == current_user["user_id"],
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if not record.cid:
        raise HTTPException(status_code=404, detail="File storage path not available")

    url = await get_signed_url(record.cid)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return {"download_url": url, "filename": record.filename}
