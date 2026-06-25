from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    filename: str
    scale_m_per_px: Optional[float] = None
    created_at: datetime
