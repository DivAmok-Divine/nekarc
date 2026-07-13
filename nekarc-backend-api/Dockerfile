# nekarc backend — FastAPI + SQLAlchemy + Alembic
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first for better layer caching (shapely/ezdxf/reportlab ship wheels).
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# App + migrations
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# SQLite DB + uploads live here — mount a volume at runtime to persist them.
RUN mkdir -p data/uploads
VOLUME ["/app/data"]

# Startup runs `alembic upgrade head` (see app/database.py) then serves the API.
# Honour a platform-provided $PORT (Render/Railway/Fly) else default to 3333.
EXPOSE 3333
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3333}"]
