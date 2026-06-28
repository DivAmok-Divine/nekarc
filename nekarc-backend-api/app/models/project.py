from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils import utcnow


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), default="Untitled Building")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    owner: Mapped["User"] = relationship(back_populates="projects")
    floors: Mapped[list["Floor"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Floor.order_index",
    )
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    # ── aggregates for the dashboard cards ──
    @property
    def floor_count(self) -> int:
        return len(self.floors)

    @property
    def room_count(self) -> int:
        return sum(len(f.rooms) for f in self.floors)

    @property
    def device_count(self) -> int:
        return sum(
            r.workstations + r.wifi_devices + r.printers + r.cameras + r.servers
            for f in self.floors
            for r in f.rooms
        )
