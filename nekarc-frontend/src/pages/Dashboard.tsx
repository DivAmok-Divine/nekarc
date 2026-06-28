import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi, type ProjectSummary } from "../api/projects";
import Brand from "../components/Brand";
import UserMenu from "../components/UserMenu";
import Icon from "../components/Icon";
import { useConfirm } from "../components/confirm";

// Backend stores naive UTC — append Z so it converts to local time correctly.
const toLocal = (iso: string) => new Date(iso.endsWith("Z") ? iso : iso + "Z");
const fmtDateTime = (iso: string) =>
  toLocal(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) =>
  toLocal(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Dashboard() {
  const nav = useNavigate();
  const confirm = useConfirm();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setProjects(await projectsApi.list());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // Don't create anything yet — open a draft. It's persisted on first Save/Generate.
  function createProject() {
    nav("/projects/new");
  }

  async function del(e: React.MouseEvent, p: ProjectSummary) {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete "${p.name}"?`,
      message: "This permanently removes the project and its design.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await projectsApi.remove(p.id);
    load();
  }

  return (
    <div className="page">
      <header className="topbar">
        <Brand />
        <div className="spacer" />
        <UserMenu />
      </header>

      {loading ? (
        <main className="container"><p className="muted">Loading…</p></main>
      ) : projects.length === 0 ? (
        <main className="container container-center">
          <div className="empty">
            <Brand size={46} />
            <p className="muted">No projects yet. Create your first building.</p>
            <button className="btn btn-primary" onClick={createProject}><Icon name="plus" size={16} /> New project</button>
          </div>
        </main>
      ) : (
        <main className="container">
          <div className="row-between">
            <div>
              <h1 className="h1">Your projects</h1>
              <p className="muted">Each project is a building you design a network for.</p>
            </div>
            <button className="btn btn-primary" onClick={createProject}><Icon name="plus" size={16} /> New project</button>
          </div>
          <div className="proj-grid">
            {projects.map((p) => (
              <div key={p.id} className="proj-card" onClick={() => nav(`/projects/${p.id}`)}>
                <button className="proj-del" onClick={(e) => del(e, p)} title="Delete"><Icon name="x" size={14} /></button>
                <div className="proj-card-head">
                  <span className="proj-icon"><Icon name="building" size={18} /></span>
                  <div className="proj-name">{p.name}</div>
                </div>
                <div className="proj-stats">
                  <span className="proj-stat"><b>{p.floor_count}</b> floor{p.floor_count !== 1 ? "s" : ""}</span>
                  <span className="proj-stat"><b>{p.room_count}</b> room{p.room_count !== 1 ? "s" : ""}</span>
                  <span className="proj-stat"><b>{p.device_count}</b> device{p.device_count !== 1 ? "s" : ""}</span>
                </div>
                <div className="proj-meta">
                  <div>Updated {fmtDateTime(p.updated_at)}</div>
                  <div>Created {fmtDate(p.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
