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
- Frontend `npm run build` succeeds (56 modules) · `npm run typecheck` clean.
- Plan-upload flow (2026-07-12): upload → list → GET file bytes → PATCH scale → PUT polygon/area round-trip.
- Geometry engine (2026-07-12): 17 unit checks pass (backward-compat, coverage APs, 90 m/IDF split, demand-driven).
- PDF report (2026-07-12): renders geometry totals + a per-floor summary table (area/cable/run/IDF); count-only path unchanged.
- DXF geometry (2026-07-12): 10 unit checks — `parse_dxf` emits polygons/areas/names; import carries `polygon_json`.
- Token refresh (2026-07-12): 7 client-logic checks (single-flight, retry, logout-on-fail) + backend refresh flow verified.
- Diagram/xyflow (2026-07-12): typecheck + build clean, code-split into a lazy Diagram chunk; HMR compiles clean. Not browser-driven.
- Alembic (2026-07-12): fresh-DB upgrade + dev-DB adoption + data-intact + `alembic check` (no drift) all verified.
- Import review (2026-07-13): `ImportPlanModal` is now an editable draft (rename/recount/delete floors & rooms) before apply; typecheck + build clean. Not browser-driven.

## Architecture notes / decisions
- **Whole-project save:** `PUT /api/projects/{id}` replaces all floors/rooms (matches load/save-whole model).
  See `app/api/routes/projects.py::_apply_floors`.
- **Datetimes are naive UTC** everywhere (`app/utils.py::utcnow`) to avoid SQLite tz comparison bugs.
- **Uploads:** binaries saved to `data/uploads/`, metadata in `assets` table (not BLOBs).
- **API prefix:** everything under `/api` (routers mounted in `app/main.py`).
- **Build does not type-check** (`build` = `vite build`); run `npm run typecheck` separately.

## What's stubbed / TODO (next milestones)
1. ~~**Floor-plan canvas**~~ **DONE (2026-07-12).** `src/pages/results/FloorPlan.tsx` is now an interactive
   trace canvas — built with a hand-rolled **SVG overlay** (not react-konva: zero deps, image/polygon
   alignment via a shared `viewBox`, matches Diagram's style). Upload PNG/JPG → pan/zoom → "Set scale"
   (draw a known-length line) → "Trace" rooms → area auto-computed (shoelace × scale²) → saved to
   `polygon_json`/`area_m2`. New backend routes in `uploads.py`: `GET /uploads`, `GET /uploads/{id}/file`,
   `PATCH /uploads/{id}` (persists `scale_m_per_px`). Geometry syncs back via an `onProjectChange` prop
   threaded ProjectEditor → ResultsView → FloorPlan.
2. **CAD parsing depth:** `parse_dxf` now returns per-room `polygon` coordinates (normalized to a
   top-left/y-down display space) — the DXF import carries these to rooms as `polygon_json`, so CAD plans
   are geometry-aware and render on the canvas's geometry-only view (no background image needed).
   *Still open:* `cad_parser.py` reads closed LWPOLYLINEs only — add wall-segment closed-loop room
   detection for messy exports that don't use closed polylines.
3. ~~**Diagram upgrade**~~ **DONE (2026-07-12).** `src/pages/results/Diagram.tsx` now uses **@xyflow/react**
   (v12): custom `DeviceNode` cards, hierarchical layout (router → core → floor switches → endpoints),
   pan/zoom/drag, Controls + MiniMap + Background, and `colorMode` bound to the app theme. Lazy-loaded via
   `React.lazy` in `ResultsView` so xyflow (~60 KB gz) is code-split into its own chunk — the main bundle is
   unchanged (75 KB gz). Servers/endpoint types now shown too.
4. ~~**Geometry-aware sizing**~~ **DONE (2026-07-12).** `calcNetwork` now uses `room.area_m2` (kept pure —
   no scale needed; areas are already metric). Adds **AP coverage-by-area** (`aps = max(capacity, ceil(area/150m²))`,
   only where WiFi is demanded) and **cable-run estimation** from an equivalent-square floor (side=√area):
   avg/max run with routing + slack, total Cat6A metres → 305 m boxes, and the **TIA 90 m** limit splits a
   floor into extra IDFs (raising patch-panel/fiber/rack counts). Fully backward-compatible: no areas →
   identical legacy output. Constants in `src/engine/constants.ts`. Surfaced in the Summary tab + stat bar + BOM.
5. ~~**Alembic migrations**~~ **DONE (2026-07-12).** Alembic is set up (`alembic/`, `alembic.ini`) — `env.py`
   pulls the URL from app settings and uses `render_as_batch` (SQLite) + `compare_type`. The `create_all` +
   manual `theme`-column hack is gone; `init_db()` now runs `alembic upgrade head` and auto-adopts a
   pre-Alembic DB (stamps the baseline, then upgrades). Baseline migration `3bc00de8c616` captures all 6
   tables; `alembic check` reports no drift. **New schema change → `alembic revision --autogenerate -m "…"`,
   review, commit; it applies on next boot.**
6. ~~**Use refresh token on 401**~~ **DONE (2026-07-12).** `src/api/client.ts` now has a central `doFetch`
   that, on a 401 for an authed request, transparently calls `/api/auth/refresh` (single-flight — concurrent
   401s share one refresh), stores the rotated pair, and retries once; it only logs out if the refresh itself
   fails. Keeps sessions alive past the 30-min access-token expiry (refresh lasts 7 days). *Note:* refresh is
   stateless — old refresh tokens aren't server-side-revoked; true rotation-with-revocation would need a
   refresh-token table (fine to defer).

## Conventions
- Backend routes: `app/api/routes/*.py`, mounted in `app/main.py` under `/api`.
- New model → add to `app/models/`, import in `app/models/__init__.py`.
- Frontend API calls go through `src/api/client.ts` (`api`, `apiUpload`, `apiBlob`).
- Engine constants (the domain model) live in `src/engine/constants.ts` — `DEVICES_PER_AP`, `HEADROOM`,
  `UPLINK_PORTS`, `VLANS`. Change these to change the engineering assumptions.

## Push to GitHub
`./push-to-github.sh` (prompts for a message). Repo: **github.com/DivAmok-Divine/nekarc**.
Credentials in `.git-push.env` (git-ignored). ⚠️ The PAT was shared in chat — **rotate it**.
