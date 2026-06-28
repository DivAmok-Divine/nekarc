from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoomIn(BaseModel):
    name: str = "Room 1"
    workstations: int = Field(default=0, ge=0, le=9999)
    wifi_devices: int = Field(default=0, ge=0, le=9999)
    printers: int = Field(default=0, ge=0, le=9999)
    cameras: int = Field(default=0, ge=0, le=9999)
    servers: int = Field(default=0, ge=0, le=9999)
    polygon_json: Optional[str] = None
    area_m2: Optional[float] = None


class RoomOut(RoomIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class FloorIn(BaseModel):
    name: str = "Floor 1"
    order_index: int = 0
    rooms: list[RoomIn] = []


class FloorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    order_index: int
    rooms: list[RoomOut] = []


class ProjectCreate(BaseModel):
    name: str = "Untitled Building"
    floors: list[FloorIn] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    floors: Optional[list[FloorIn]] = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    floor_count: int = 0
    room_count: int = 0
    device_count: int = 0


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    floors: list[FloorOut] = []
