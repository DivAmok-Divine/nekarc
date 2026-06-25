import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# Ensure the SQLite directory exists ("sqlite:///./data/app.db" -> "./data")
if settings.DATABASE_URL.startswith("sqlite"):
    _db_path = settings.DATABASE_URL.replace("sqlite:///", "", 1)
    os.makedirs(os.path.dirname(_db_path) or ".", exist_ok=True)

_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


def init_db() -> None:
    """Create tables. v1 uses create_all; Alembic migrations are a later step."""
    from app import models  # noqa: F401  ensure all models are registered on Base

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    Base.metadata.create_all(bind=engine)

    # Lightweight migration for existing SQLite DBs (until Alembic lands):
    # add new columns that create_all won't add to an already-existing table.
    if settings.DATABASE_URL.startswith("sqlite"):
        with engine.begin() as conn:
            cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)")]
            if "theme" not in cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'system'")
