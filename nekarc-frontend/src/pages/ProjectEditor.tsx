import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectsApi } from "../api/projects";
import { calcNetwork } from "../engine/calcNetwork";
import type { Floor, Project, Room } from "../engine/types";
import ResultsView from "./results/ResultsView";
import UserMenu from "../components/UserMenu";
import Icon from "../components/Icon";
import { useConfirm } from "../components/confirm";

const uid = () => Math.random().toString(36).slice(2, 10);
const newRoom = (n: number): Room => ({
  id: uid(), name: `Room ${n}`, workstations: 0, wifi_devices: 0, printers: 0, cameras: 0, servers: 0,
});
const newFloor = (n: number): Floor => ({ id: uid(), name: `Floor ${n}`, order_index: n - 1, rooms: [newRoom(1)] });

const roomTotal = (r: Room) => r.workstations + r.wifi_devices + r.printers + r.cameras + r.servers;
const roomHasData = (r: Room) => roomTotal(r) > 0;

/** Returns the list of issues blocking a valid design (empty = good to generate). */
function validate(p: Project): string[] {
  const issues: string[] = [];
  if (!p.name.trim()) issues.push("Give the project a name.");
  p.floors.forEach((f) => {
    if (!f.name.trim()) issues.push("Every floor needs a name.");
    f.rooms.forEach((r) => {
      if (!r.name.trim()) issues.push(`${f.name || "A floor"}: a room needs a name.`);
      if (roomTotal(r) === 0) issues.push(`${f.name || "Floor"} · ${r.name || "room"}: add at least one device.`);
    });
  });
  return [...new Set(issues)];
}

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

// [key, icon name, label, role color] — colors match the VLAN segments in the design output.
const FIELDS: [keyof Room, string, string, string][] = [
  ["workstations", "monitor", "Workstations", "#3b82f6"],
  ["wifi_devices", "wifi", "WiFi devices", "#f59e0b"],
  ["printers", "printer", "Printers", "#8b5cf6"],
  ["cameras", "camera", "IP cameras", "#ef4444"],
  ["servers", "server", "Servers", "#10b981"],
];

export default function ProjectEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const [project, setProject] = useState<Project | null>(null);
  const [activeFloor, setActiveFloor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [toast, setToast] = useState("");
  const floorNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => setProject(fromServer(await projectsApi.get(id!))))();
  }, [id]);

  const design = useMemo(() => (project ? calcNetwork(project) : null), [project]);
  const issues = useMemo(() => (project ? validate(project) : []), [project]);

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
      showToast("Saved");
    } catch {
      showToast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addFloor() {
    update((p) => p.floors.push(newFloor(p.floors.length + 1)));
    setActiveFloor(project!.floors.length);
  }

  async function delFloor(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    if (project!.floors.length <= 1) return;
    const f = project!.floors[i];
    // Confirm only if the floor actually holds device data; otherwise delete silently.
    if (f.rooms.some(roomHasData)) {
      const ok = await confirm({
        title: `Delete "${f.name}"?`,
        message: "This floor has device data that will be lost.",
        confirmLabel: "Delete floor",
        danger: true,
      });
      if (!ok) return;
    }
    const count = project!.floors.length;
    update((p) => p.floors.splice(i, 1));
    setActiveFloor((a) => Math.min(a, count - 2));
  }

  function editFloor(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    setActiveFloor(i);
    // jump focus to the floor's name field so it can be renamed immediately
    setTimeout(() => {
      floorNameRef.current?.focus();
      floorNameRef.current?.select();
    }, 0);
  }

  function addRoom() {
    update((p) => p.floors[activeFloor].rooms.push(newRoom(p.floors[activeFloor].rooms.length + 1)));
  }

  async function delRoom(ri: number) {
    const r = project!.floors[activeFloor].rooms[ri];
    if (roomHasData(r)) {
      const ok = await confirm({
        title: `Delete "${r.name}"?`,
        message: "This room has device data that will be lost.",
        confirmLabel: "Delete room",
        danger: true,
      });
      if (!ok) return;
    }
    update((p) => p.floors[activeFloor].rooms.splice(ri, 1));
  }

  const floor = project.floors[activeFloor];

  return (
    <div className="page page-shell">
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => nav("/")}><Icon name="arrow-left" size={15} /> Projects</button>
        <input className="proj-title-input" value={project.name} onChange={(e) => update((p) => { p.name = e.target.value; })} />
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={save} disabled={saving}>
          <Icon name="save" size={15} /> {saving ? "Saving…" : "Save"}
        </button>
        {showResults ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowResults(false)} style={{ color: "var(--amber)" }}>
            <Icon name="pencil" size={15} /> Edit
          </button>
        ) : (
          <button
            className={`btn btn-primary ${issues.length > 0 ? "disabled-soft" : ""}`}
            title={issues[0] || "Generate the network design"}
            onClick={async () => { if (issues.length > 0) return; await save(); setShowResults(true); }}
          >
            <Icon name="zap" size={15} /> Generate Design
          </button>
        )}
        <UserMenu />
      </header>

      {showResults && design ? (
        <ResultsView project={project} design={design} projectId={id!} />
      ) : (
        <div className="editor">
          <aside className="floor-side">
            <div className="side-head">
              Floors
              <button className="btn btn-ghost btn-icon btn-sm" onClick={addFloor} title="Add floor"><Icon name="plus" size={15} /></button>
            </div>
            {project.floors.map((f, i) => (
              <div key={f.id} className={`floor-item ${i === activeFloor ? "active" : ""}`} onClick={() => setActiveFloor(i)}>
                <div>
                  <div className="fi-name">{f.name}</div>
                  <div className="fi-sub">{f.rooms.length} room{f.rooms.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="floor-actions">
                  <button className="floor-edit" onClick={(e) => editFloor(e, i)} title="Rename floor"><Icon name="pencil" size={13} /></button>
                  <button
                    className="floor-del"
                    onClick={(e) => delFloor(e, i)}
                    disabled={project.floors.length <= 1}
                    title={project.floors.length <= 1 ? "Can't delete the only floor" : "Delete floor"}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </aside>

          <section className="editor-main">
            {issues.length > 0 && (
              <div className="validation">
                <span className="validation-ico"><Icon name="alert" size={16} /></span>
                <div>
                  <strong>{issues.length} thing{issues.length > 1 ? "s" : ""} to fix before generating</strong>
                  <ul>{issues.slice(0, 4).map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              </div>
            )}

            <div className="floor-head">
              <span className="floor-ico"><Icon name="building" size={18} /></span>
              <input ref={floorNameRef} type="text" className="floor-name-input" value={floor.name} onChange={(e) => update((p) => { p.floors[activeFloor].name = e.target.value; })} />
              <button className="btn btn-ghost btn-sm" onClick={addRoom}><Icon name="plus" size={15} /> Add Room</button>
            </div>

            {floor.rooms.map((r, ri) => {
              const invalid = !r.name.trim() || !roomHasData(r);
              return (
                <div className={`card room-card ${invalid ? "invalid" : ""}`} key={r.id}>
                  <div className="room-head">
                    <span className="room-num">#{ri + 1}</span>
                    <input type="text" className="room-name-input" value={r.name} onChange={(e) => update((p) => { p.floors[activeFloor].rooms[ri].name = e.target.value; })} />
                    {floor.rooms.length > 1 && (
                      <button className="btn btn-ghost btn-sm btn-danger" onClick={() => delRoom(ri)}>
                        <Icon name="x" size={14} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="room-grid">
                    {FIELDS.map(([k, icon, label, color]) => {
                      const val = (r as any)[k] as number;
                      const setVal = (n: number) =>
                        update((p) => {
                          (p.floors[activeFloor].rooms[ri] as any)[k] = Math.max(0, n);
                        });
                      return (
                        <div className="dev-tile" key={String(k)} style={{ ["--role" as any]: color }}>
                          <div className="dev-tile-head">
                            <span className="dev-ico" style={{ color }}><Icon name={icon} size={15} /></span>
                            <span className="dev-label">{label}</span>
                          </div>
                          <div className="stepper">
                            <button type="button" className="step" onClick={() => setVal(val - 1)} disabled={val <= 0} aria-label={`decrease ${label}`}><Icon name="minus" size={14} /></button>
                            <input
                              type="number"
                              className="dev-input"
                              min={0}
                              placeholder="0"
                              value={val === 0 ? "" : val}
                              onChange={(e) => setVal(parseInt(e.target.value) || 0)}
                            />
                            <button type="button" className="step" onClick={() => setVal(val + 1)} aria-label={`increase ${label}`}><Icon name="plus" size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button className="add-room-btn" onClick={addRoom}><Icon name="plus" size={15} /> Add another room</button>
          </section>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
