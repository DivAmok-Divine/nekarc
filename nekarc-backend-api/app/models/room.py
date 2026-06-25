from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120), default="Room 1")

    # ── device counts (the five network roles) ──
    workstations: Mapped[int] = mapped_column(Integer, default=0)
    wifi_devices: Mapped[int] = mapped_column(Integer, default=0)
    printers: Mapped[int] = mapped_column(Integer, default=0)
    cameras: Mapped[int] = mapped_column(Integer, default=0)
    servers: Mapped[int] = mapped_column(Integer, default=0)

    # ── geometry (from CAD parse or PNG trace) — optional ──
    polygon_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area_m2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    floor: Mapped["Floor"] = relationship(back_populates="rooms")
