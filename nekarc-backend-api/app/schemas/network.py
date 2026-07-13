from typing import Any

from pydantic import BaseModel


class BomItem(BaseModel):
    cat: str
    item: str
    qty: int
    note: str = ""


class PlanImage(BaseModel):
    name: str = ""
    image: str = ""  # base64-encoded PNG (no data: prefix)
    w: int = 0
    h: int = 0


class DesignReport(BaseModel):
    """The computed design the client sends back for server-side PDF rendering."""

    totals: dict[str, Any] = {}
    floors: list[dict[str, Any]] = []
    bom: list[BomItem] = []
    vlans: list[dict[str, Any]] = []
    plans: list[PlanImage] = []
