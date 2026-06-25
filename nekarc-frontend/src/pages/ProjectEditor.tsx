import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { calcNetwork } from "../engine/calcNetwork";
import type { Floor, Project, Room } from "../engine/types";
import ResultsView from "./results/ResultsView";

const uid = () => Math.random().toString(36).slice(2, 10);
const newRoom = (n: number): Room => ({
  id: uid(), name: `Room ${n}`, workstations: 0, wifi_devices: 0, printers: 0, cameras: 0, servers: 0,
});
const newFloor = (n: number): Floor => ({ id: uid(), name: `Floor ${n}`, order_index: n - 1, rooms: [newRoom(1)] });

function fromServer(p: any): Project {
  return {
    id: p.id,
    name: p.name,
    floors: (p.floors || []).map((f: any, fi: number) => ({
      id: String(f.id ?? uid()),
      name: f.name,
      order_index: f.order_index ?? fi,
      rooms: (f.rooms || []).map((r: any) => ({
        id: String(r.id ?? uid()),
        name: r.name,
        workstations: r.workstations,
        wifi_devices: r.wifi_devices,
        printers: r.printers,
        cameras: r.cameras,
        servers: r.servers,
        polygon_json: r.polygon_json,
        area_m2: r.area_m2,
      })),
    })),
  };
}

function toPayload(p: Project) {
  return {
    name: p.name,
    floors: p.floors.map((f, i) => ({
      name: f.name,
      order_index: i,
      rooms: f.rooms.map((r) => ({
        name: r.name,
        workstations: r.workstations,
        wifi_devices: r.wifi_devices,
        printers: r.printers,
        cameras: r.cameras,
        servers: r.servers,
        polygon_json: r.polygon_json ?? null,
        area_m2: r.area_m2 ?? null,
      })),
    })),
  };
}

const FIELDS: [keyof Room, string, string][] = [
  ["workstations", "💻", "Workstations"],
  ["wifi_devices", "📶", "WiFi Devices"],
  ["printers", "🖨️", "Printers"],
  ["cameras", "📷", "IP Cameras"],
  ["servers", "🖥️", "Servers"],
];

export default function ProjectEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [activeFloor, setActiveFloor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => setProject(fromServer(await projectsApi.get(id!))))();
  }, [id]);

  const design = useMemo(() => (project ? calcNetwork(project) : null), [project]);

  if (!project) return <div className="center muted">Loading…</div>;

  function update(mut: (p: Project) => void) {
    setProject((prev) => {
      const next = structuredClone(prev!);
      mut(next);
      return next;
    });
  }
  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2000);
  }

  async function save() {
    setSaving(true);
    try {
      await projectsApi.update(id!, toPayload(project!));
      showToast("Saved ✓");
    } catch {
      showToast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addFloor() {
    update((p) => p.floors.push(newFloor(p.floors.length + 1)));
    setActiveFloor(project.floors.length);
  }
  function delFloor(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    if (project.floors.length <= 1) return;
    if (!confirm("Delete this floor?")) return;
    update((p) => p.floors.splice(i, 1));
    setActiveFloor((a) => Math.min(a, project.floors.length - 2));
  }
  function addRoom() {
    update((p) => p.floors[activeFloor].rooms.push(newRoom(p.floors[activeFloor].rooms.length + 1)));
  }
  function delRoom(ri: number) {
    update((p) => p.floors[activeFloor].rooms.splice(ri, 1));
  }

  const floor = project.floors[activeFloor];

  return (
    <div className="page">
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => nav("/")}>← Projects</button>
        <input className="proj-title-input" value={project.name} onChange={(e) => update((p) => { p.name = e.target.value; })} />
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</button>
        {showResults ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowResults(false)} style={{ color: "var(--amber)" }}>✏ Edit</button>
        ) : (
          <button className="btn btn-primary" onClick={async () => { await save(); setShowResults(true); }}>⚡ Generate Design</button>
        )}
      </header>

      {showResults && design ? (
        <ResultsView project={project} design={design} projectId={id!} />
      ) : (
        <div className="editor">
          <aside className="floor-side">
            <div className="side-head">
              Floors
              <button className="btn btn-ghost btn-icon btn-sm" onClick={addFloor} title="Add floor">＋</button>
            </div>
            {project.floors.map((f, i) => (
              <div key={f.id} className={`floor-item ${i === activeFloor ? "active" : ""}`} onClick={() => setActiveFloor(i)}>
                <div>
                  <div className="fi-name">{f.name}</div>
                  <div className="fi-sub">{f.rooms.length} room{f.rooms.length !== 1 ? "s" : ""}</div>
                </div>
                {project.floors.length > 1 && <button className="floor-del" onClick={(e) => delFloor(e, i)}>✕</button>}
              </div>
            ))}
          </aside>

          <section className="editor-main">
            <div className="row" style={{ gap: 12, marginBottom: 18 }}>
              <input className="floor-name-input" value={floor.name} onChange={(e) => update((p) => { p.floors[activeFloor].name = e.target.value; })} />
              <button className="btn btn-ghost btn-sm" onClick={addRoom}>＋ Add Room</button>
            </div>

            {floor.rooms.map((r, ri) => (
              <div className="card" key={r.id}>
                <div className="card-head">
                  <span className="muted" style={{ fontWeight: 700, minWidth: 24 }}>#{ri + 1}</span>
                  <input className="room-name-input" value={r.name} onChange={(e) => update((p) => { p.floors[activeFloor].rooms[ri].name = e.target.value; })} />
                  {floor.rooms.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => delRoom(ri)}>Remove</button>
                  )}
                </div>
                <div className="room-grid">
                  {FIELDS.map(([k, icon, label]) => (
                    <div key={String(k)}>
                      <label>{icon} {label}</label>
                      <input
                        type="number"
                        min={0}
                        value={(r as any)[k]}
                        onChange={(e) =>
                          update((p) => {
                            (p.floors[activeFloor].rooms[ri] as any)[k] = Math.max(0, parseInt(e.target.value) || 0);
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="add-room-btn" onClick={addRoom}>＋ Add another room</button>
          </section>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
