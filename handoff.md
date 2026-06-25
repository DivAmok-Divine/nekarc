# nekarc — Handoff

Continue work in a fresh chat from this file. Last updated: 2026-06-25.

## What this is
**nekarc (Network Architect)** — describe a building (floors → rooms → device counts) and it generates a
full enterprise LAN design: topology diagram, bill of materials, IP plan, VLAN scheme, PDF report.
The core is one pure function, `calcNetwork()`, that applies network-engineering sizing heuristics.

## Stack (decided)
- **Frontend:** React 18 + TypeScript + Vite (`nekarc-frontend/`)
- **Backend:** FastAPI + SQLAlchemy 2 + Pydantic v2 (`nekarc-backend-api/`)
- **DB:** SQLite, relational schema, file at `nekarc-backend-api/data/app.db`
- **Auth:** JWT access+refresh, bcrypt, password-reset tokens table
- **CAD/geometry:** ezdxf + shapely · **PDF:** reportlab (server-side)
- The calc engine lives **client-side** (`nekarc-frontend/src/engine/`) for instant feedback; the
  backend persists inputs and renders the PDF from the design the client posts.

## Run it
```bash
./start.sh        # venv + npm install + both servers
./stop.sh
```
Frontend http://localhost:2222 · API docs http://localhost:3333/docs · logs in `.run/`.
Dev proxy: Vite forwards `/api/*` → `:3333` (see `nekarc-frontend/vite.config.ts`).

## Verified working (smoke-tested)
- Backend imports, boots, `create_all` builds tables.
- Auth end-to-end: register → tokens → `/users/me` → create/list project (nested floors+rooms).
- Forgot-password: token created, reset link printed to backend console (no SMTP in dev).
- Frontend `npm run build` succeeds (49 modules).

## Architecture notes / decisions
- **Whole-project save:** `PUT /api/projects/{id}` replaces all floors/rooms (matches load/save-whole model).
  See `app/api/routes/projects.py::_apply_floors`.
- **Datetimes are naive UTC** everywhere (`app/utils.py::utcnow`) to avoid SQLite tz comparison bugs.
- **Uploads:** binaries saved to `data/uploads/`, metadata in `assets` table (not BLOBs).
- **API prefix:** everything under `/api` (routers mounted in `app/main.py`).
- **Build does not type-check** (`build` = `vite build`); run `npm run typecheck` separately.

## What's stubbed / TODO (next milestones)
1. **Floor-plan canvas (biggest):** `src/pages/results/FloorPlan.tsx` currently only uploads files.
   Build the interactive trace/place canvas with **react-konva** (`npm i konva react-konva`):
   - PNG path: draw room polygons + scale calibration → save `polygon_json`/`area_m2` to rooms.
   - DXF path: call `POST /api/projects/{id}/cad/parse/{asset_id}`, map returned polygons to rooms.
2. **CAD parsing depth:** `app/services/cad_parser.py` reads closed LWPOLYLINEs only. Add wall-segment
   closed-loop room detection for messy exports.
3. **Diagram upgrade:** `src/pages/results/Diagram.tsx` is hand-rolled SVG. Migrate to **@xyflow/react**
   (`npm i @xyflow/react`) for pan/zoom/interactivity.
4. **Geometry-aware sizing:** once rooms have polygons, extend `calcNetwork` for real cable-run lengths
   and AP coverage-by-area (vs. the current count-only model).
5. **Alembic migrations:** v1 uses `Base.metadata.create_all`. Add `alembic init` before schema changes ship.
6. **Refresh-token rotation/use on 401:** client currently just logs out on 401; wire `/api/auth/refresh`.

## Conventions
- Backend routes: `app/api/routes/*.py`, mounted in `app/main.py` under `/api`.
- New model → add to `app/models/`, import in `app/models/__init__.py`.
- Frontend API calls go through `src/api/client.ts` (`api`, `apiUpload`, `apiBlob`).
- Engine constants (the domain model) live in `src/engine/constants.ts` — `DEVICES_PER_AP`, `HEADROOM`,
  `UPLINK_PORTS`, `VLANS`. Change these to change the engineering assumptions.

## Push to GitHub
`./push-to-github.sh` (prompts for a message). Repo: **github.com/DivAmok-Divine/nekarc**.
Credentials in `.git-push.env` (git-ignored). ⚠️ The PAT was shared in chat — **rotate it**.
