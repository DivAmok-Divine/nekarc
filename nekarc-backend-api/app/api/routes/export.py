from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import Project, User
from app.schemas.network import DesignReport
from app.services.pdf_report import build_pdf

router = APIRouter(prefix="/projects/{project_id}/export", tags=["export"])


@router.post("/pdf")
def export_pdf(
    project_id: int,
    report: DesignReport,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    pdf_bytes = build_pdf(project.name, report.model_dump())
    filename = (project.name or "network").replace(" ", "-") + "-network-design.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
