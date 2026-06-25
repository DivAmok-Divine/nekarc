from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models import Floor, Project, Room, User
from app.schemas.project import (FloorIn, ProjectCreate, ProjectOut,
                                 ProjectSummary, ProjectUpdate)

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_owned(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _apply_floors(project: Project, floors: list[FloorIn]) -> None:
    """Replace-all strategy — matches the load/save-whole-project model."""
    project.floors.clear()
    for fi, f in enumerate(floors):
        floor = Floor(name=f.name, order_index=f.order_index or fi)
        for r in f.rooms:
            floor.rooms.append(
                Room(
                    name=r.name,
                    workstations=r.workstations,
                    wifi_devices=r.wifi_devices,
                    printers=r.printers,
                    cameras=r.cameras,
                    servers=r.servers,
                    polygon_json=r.polygon_json,
                    area_m2=r.area_m2,
                )
            )
        project.floors.append(floor)


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(name=data.name, user_id=user.id)
    db.add(project)
    if data.floors:
        _apply_floors(project, data.floors)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _get_owned(db, user, project_id)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_owned(db, user, project_id)
    if data.name is not None:
        project.name = data.name
    if data.floors is not None:
        _apply_floors(project, data.floors)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _get_owned(db, user, project_id)
    db.delete(project)
    db.commit()
