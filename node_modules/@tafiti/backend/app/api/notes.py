from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.models.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.models.database import Note
from app.core.security import get_current_user
from sqlalchemy.future import select
from datetime import datetime
from app.core.logger import get_logger

logger = get_logger("notes_api")
router = APIRouter()

@router.get("/", response_model=List[NoteResponse])
async def get_notes(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Note).where(Note.user_id == current_user["user_id"]).order_by(Note.updated_at.desc())
    )
    return result.scalars().all()

@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_in: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    note = Note(
        user_id=current_user["user_id"],
        title=note_in.title,
        content=note_in.content,
        tags=note_in.tags
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user["user_id"])
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    note_in: NoteUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user["user_id"])
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = note_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)
    
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return note

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == current_user["user_id"])
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.delete(note)
    await db.commit()
    return None
