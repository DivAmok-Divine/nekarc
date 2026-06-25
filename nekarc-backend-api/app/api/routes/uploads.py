import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models import Asset, Project, User
from app.schemas.asset import AssetOut

router = APIRouter(prefix="/projects/{project_id}/uploads", tags=["uploads"])

ALLOWED = {"png": "png", "jpg": "jpg", "jpeg": "jpg", "dxf": "dxf"}


@router.post("", response_model=AssetOut, status_code=201)
async def upload_plan(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, or DXF files are allowed")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored = f"{uuid.uuid4().hex}.{ext}"
    dest = os.path.join(settings.UPLOAD_DIR, stored)
    with open(dest, "wb") as out:
        out.write(await file.read())

    asset = Asset(
        project_id=project.id,
        kind=ALLOWED[ext],
        filename=file.filename or stored,
        path=dest,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
