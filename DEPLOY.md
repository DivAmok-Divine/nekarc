# Deploy nekarc — free, one URL (Hugging Face Spaces + Neon)

The whole app runs as **one Docker container** (FastAPI serves the built frontend
and the `/api`), on **Hugging Face Spaces** (free, no card), with data in a free
**Neon Postgres** so logins/projects survive restarts.

Result: a single public URL like `https://<user>-nekarc.hf.space`.

---

## 1. Free Postgres (Neon) — ~2 min
1. Go to <https://neon.tech> → sign up (GitHub/Google/email, no card).
2. Create a project (any name/region).
3. Copy the **connection string** — looks like:
   `postgresql://user:pass@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`
   Keep it for step 3.

## 2. Create the Space — ~2 min
1. Go to <https://huggingface.co> → sign up (no card).
2. **New → Space**: owner `divamokdivine`, name `nekarc`, **SDK = Docker**, **Blank**, visibility public.
   This creates a git repo at `https://huggingface.co/spaces/divamokdivine/nekarc`.
3. Create a **write token**: HF → Settings → Access Tokens → New token (role: *write*).

## 3. Set the secrets (Space → Settings → *Variables and secrets*)
Add these as **secrets**:

| Name | Value |
|------|-------|
| `DATABASE_URL` | the Neon string from step 1 |
| `SECRET_KEY` | a long random string (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | your Gemini key (for AI plan import) |

(No `CORS_ORIGINS` needed — frontend and API share one origin.)

## 4. Push the repo to the Space
From the project root:
```bash
git remote add hf https://huggingface.co/spaces/divamokdivine/nekarc
# push whichever branch has this code onto the Space's main branch
git push https://divamokdivine:<HF_WRITE_TOKEN>@huggingface.co/spaces/divamokdivine/nekarc HEAD:main
```
The Space builds the root `Dockerfile` (frontend build → served by the backend),
runs Alembic migrations against Neon on startup, and boots on port 7860.

Watch **App → Logs**; when it's green, open the Space URL — the whole app works there.

---

## Notes / limits (free tier)
- **Sleeps when idle** → first hit after a while takes ~30–60s to wake, then it's fast.
- **DB is durable** (Neon), but **uploaded plan images are not** — the container disk
  resets on rebuild/restart, so previously-uploaded plan files are lost (project data,
  rooms, and placement stay because they're in Postgres). For durable uploads later,
  add object storage (Cloudflare R2 / Supabase Storage).
- To update: push to the Space's `main` again — it rebuilds automatically.

## Alternative: Vercel (frontend) + a container host (backend)
If you'd rather keep the Vercel frontend, host `nekarc-backend-api/Dockerfile`
separately (Render free), set Vercel env `VITE_API_URL=https://<backend>/api`, and
set the backend's `CORS_ORIGINS=https://nekarc.vercel.app`. The single-container
route above is simpler (no CORS, one URL).
