import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models import Asset, Project, User
from app.schemas.asset import AssetOut

router = APIRouter(prefix="/projects/{project_id}/uploads", tags=["uploads"])

ALLOWED = {"png": "png", "jpg": "jpg", "jpeg": "jpg", "dxf": "dxf"}
CONTENT_TYPE = {"png": "image/png", "jpg": "image/jpeg", "dxf": "application/dxf"}


def _get_owned_project(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_asset(db: Session, project: Project, asset_id: int) -> Asset:
    asset = db.get(Asset, asset_id)
    if not asset or asset.project_id != project.id:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


class ScaleIn(BaseModel):
    # metres represented by one image pixel — the PNG/JPG trace calibration.
    scale_m_per_px: float = Field(gt=0, le=1000)


@router.post("", response_model=AssetOut, status_code=201)
async def upload_plan(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_owned_project(db, user, project_id)

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


@router.get("", response_model=list[AssetOut])
def list_uploads(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_owned_project(db, user, project_id)
    return (
        db.query(Asset)
        .filter(Asset.project_id == project.id)
        .order_by(Asset.created_at.desc())
        .all()
    )


@router.get("/{asset_id}/file")
def get_upload_file(
    project_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_owned_project(db, user, project_id)
    asset = _get_asset(db, project, asset_id)
    if not os.path.isfile(asset.path):
        raise HTTPException(status_code=404, detail="File is missing on disk")
    return FileResponse(
        asset.path,
        media_type=CONTENT_TYPE.get(asset.kind, "application/octet-stream"),
        filename=asset.filename,
    )


@router.patch("/{asset_id}", response_model=AssetOut)
def set_upload_scale(
    project_id: int,
    asset_id: int,
    data: ScaleIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Persist the trace calibration (metres per pixel) so it survives a reload."""
    project = _get_owned_project(db, user, project_id)
    asset = _get_asset(db, project, asset_id)
    asset.scale_m_per_px = data.scale_m_per_px
    db.commit()
    db.refresh(asset)
    return asset
