from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import utcnow


class Asset(Base):
    """An uploaded building plan (PNG/JPG/DXF). Binary lives on disk; this is metadata."""

    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    floor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("floors.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(10))          # "png" | "jpg" | "dxf"
    filename: Mapped[str] = mapped_column(String(255))     # original upload name
    path: Mapped[str] = mapped_column(String(500))         # path under UPLOAD_DIR
    scale_m_per_px: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # PNG calibration
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    project: Mapped["Project"] = relationship(back_populates="assets")
