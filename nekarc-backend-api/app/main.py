from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, cad, export, imports, projects, uploads, users
from app.config import settings
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="nekarc API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"
app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(projects.router, prefix=API)
app.include_router(uploads.router, prefix=API)
app.include_router(imports.router, prefix=API)
app.include_router(cad.router, prefix=API)
app.include_router(export.router, prefix=API)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
