import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi, type ProjectSummary } from "../api/projects";
import Brand from "../components/Brand";
import UserMenu from "../components/UserMenu";
import Icon from "../components/Icon";
import { useConfirm } from "../components/confirm";

export default function Dashboard() {
  const nav = useNavigate();
  const confirm = useConfirm();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setProjects(await projectsApi.list());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createProject() {
    setCreating(true);
    try {
      const p: any = await projectsApi.create({
        name: "New Building",
        floors: [
          {
            name: "Floor 1",
            order_index: 0,
            rooms: [{ name: "Room 1", workstations: 0, wifi_devices: 0, printers: 0, cameras: 0, servers: 0 }],
          },
        ],
      });
      nav(`/projects/${p.id}`);
    } finally {
      setCreating(false);
    }
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
            <Brand size={42} />
            <p className="muted" style={{ marginTop: 14 }}>No projects yet. Create your first building.</p>
            <button className="btn btn-primary" onClick={createProject} disabled={creating}><Icon name="plus" size={16} /> New project</button>
          </div>
        </main>
      ) : (
        <main className="container">
          <div className="row-between">
            <div>
              <h1 className="h1">Your projects</h1>
              <p className="muted">Each project is a building you design a network for.</p>
            </div>
            <button className="btn btn-primary" onClick={createProject} disabled={creating}><Icon name="plus" size={16} /> New project</button>
          </div>
          <div className="proj-grid">
            {projects.map((p) => (
              <div key={p.id} className="proj-card" onClick={() => nav(`/projects/${p.id}`)}>
                <button className="proj-del" onClick={(e) => del(e, p)} title="Delete"><Icon name="x" size={14} /></button>
                <div className="proj-name">{p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Updated {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
