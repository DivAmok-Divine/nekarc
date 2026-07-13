# nekarc — single container: builds the frontend, serves it from the FastAPI
# backend (one origin, no CORS). Used for Hugging Face Spaces (port 7860) and
# any host that runs one container.

# ---- Stage 1: build the React/Vite frontend ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY nekarc-frontend/package.json nekarc-frontend/package-lock.json ./
RUN npm ci
COPY nekarc-frontend/ ./
# Frontend talks to /api on the same origin, so no VITE_API_URL is needed.
RUN npm run build

# ---- Stage 2: backend + serve the built frontend ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY nekarc-backend-api/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY nekarc-backend-api/app ./app
COPY nekarc-backend-api/alembic ./alembic
COPY nekarc-backend-api/alembic.ini .
# built frontend → served by app/main.py at "/"
COPY --from=frontend /fe/dist ./static

# SQLite/uploads fallback dir (with Neon Postgres set, the DB lives in Neon).
RUN mkdir -p data/uploads

# Startup runs `alembic upgrade head` then serves. HF Spaces expects 7860;
# other hosts (Render/Fly) inject $PORT.
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
