import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.dependencies import get_current_user
from app.models import User
from app.services.cad_parser import DEVICE_KEYS, parse_dxf
from app.services.plan_ai import extract_from_plan

# Parse-only (no project needed) so it works on unsaved drafts too.
router = APIRouter(prefix="/import", tags=["import"])

IMAGE_MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "pdf": "application/pdf"}
MAX_FLOORS = 30
MAX_ROOMS_PER_FLOOR = 100


def _int(v, lo: int = 0, hi: int = 9999) -> int:
    try:
        return max(lo, min(hi, int(v)))
    except Exception:  # noqa: BLE001
        return 0


def _nice_name(s: str, fallback: str) -> str:
    """Plans/CAD often label rooms in ALL CAPS — soften those to Title Case."""
    s = (s or "").strip()
    if not s:
        return fallback
    return (s.title() if s.isupper() else s)[:120]


def _normalize(result: dict) -> dict:
    """Coerce any parser/AI output into the editor's floor/room shape."""
    floors = []
    for fi, f in enumerate((result.get("floors") or [])[:MAX_FLOORS]):
        rooms = []
        for ri, r in enumerate((f.get("rooms") or [])[:MAX_ROOMS_PER_FLOOR]):
            room = {
                "name": _nice_name(str(r.get("name") or ""), f"Room {ri + 1}"),
                "area_m2": round(float(r.get("area_m2") or 0), 1),
            }
            for k in DEVICE_KEYS:
                room[k] = _int(r.get(k, 0))
            rooms.append(room)
        floors.append({"name": _nice_name(str(f.get("name") or ""), f"Floor {fi + 1}"), "rooms": rooms})
    return {
        "ok": bool(result.get("ok", True)),
        "source": result.get("source", "unknown"),
        "floors": floors,
        "building_name": _nice_name(str(result.get("building_name") or ""), ""),
        "warnings": result.get("warnings") or [],
        "error": result.get("error"),
    }


@router.post("")
async def import_plan(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    data = await file.read()

    if ext == "dxf":
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        tmp = os.path.join(settings.UPLOAD_DIR, f"_import_{uuid.uuid4().hex}.dxf")
        with open(tmp, "wb") as fh:
            fh.write(data)
        try:
            result = parse_dxf(tmp)
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    elif ext in IMAGE_MIME:
        result = extract_from_plan(data, IMAGE_MIME[ext])
    else:
        raise HTTPException(status_code=400, detail="Upload a DXF, PNG, JPG, or PDF plan")

    return _normalize(result)
