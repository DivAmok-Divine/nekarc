from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Floor(Base):
    __tablename__ = "floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120), default="Floor 1")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    # Physical device placement on the plan (JSON: idfs/aps/devices with x,y) — optional.
    placement_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="floors")
    rooms: Mapped[list["Room"]] = relationship(
        back_populates="floor", cascade="all, delete-orphan"
    )
