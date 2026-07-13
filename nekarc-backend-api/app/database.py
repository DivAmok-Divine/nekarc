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
    """Bring the schema to the latest Alembic revision — migrations are the source of truth."""
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import inspect

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(root, "alembic.ini"))

    tables = set(inspect(engine).get_table_names())
    if "alembic_version" not in tables and "users" in tables:
        # Pre-Alembic database (created by the old create_all): adopt it at the
        # baseline so the upgrade below layers on newer migrations without
        # trying to recreate the tables it already has.
        base_rev = ScriptDirectory.from_config(cfg).get_bases()[0]
        command.stamp(cfg, base_rev)

    command.upgrade(cfg, "head")
