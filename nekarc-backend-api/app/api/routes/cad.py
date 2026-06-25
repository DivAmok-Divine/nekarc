from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import Asset, Project, User
from app.services.cad_parser import parse_dxf

router = APIRouter(prefix="/projects/{project_id}/cad", tags=["cad"])


@router.post("/parse/{asset_id}")
def parse_cad(
    project_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    asset = db.get(Asset, asset_id)
    if not asset or asset.project_id != project.id:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.kind != "dxf":
        raise HTTPException(status_code=400, detail="Asset is not a DXF file")
    return parse_dxf(asset.path)
