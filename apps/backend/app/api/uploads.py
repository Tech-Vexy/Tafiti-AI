from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Dict, Any
import io
import pypdf
from app.services.pinata_service import get_pinata_service
from app.core.security import get_current_user
from app.core.subscription import require_trial_or_active
from app.core.logger import get_logger

logger = get_logger("uploads_api")
router = APIRouter()

@router.post("/pdf")
async def upload_research_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    _gate: dict = Depends(require_trial_or_active)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        content = await file.read()
        
        # 1. Extract Text
        text = ""
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")
            # We still continue to upload even if extraction fails, 
            # as the user might just want to store the file.
            pass

        # 2. Upload to Pinata
        pinata = get_pinata_service()
        cid = await pinata.upload_file(content, file.filename)

        return {
            "filename": file.filename,
            "cid": cid,
            "extracted_text": text[:5000], # Return a preview/chunk for grounding
            "full_text_length": len(text)
        }
    except Exception as e:
        logger.error(f"PDF upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await file.close()
