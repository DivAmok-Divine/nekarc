import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export interface ImportRoom {
  name: string;
  area_m2?: number;
  polygon_json?: string | null; // present for DXF imports (real room geometry)
  workstations: number;
  wifi_devices: number;
  printers: number;
  cameras: number;
  servers: number;
}
export interface ImportFloor {
  name: string;
  rooms: ImportRoom[];
}
export interface ImportResult {
  ok: boolean;
  source: string;
  floors: ImportFloor[];
  building_name?: string;
  warnings?: string[];
  error?: string | null;
}

const STEPS = [
  "Uploading the plan…",
  "Reading the floor plan…",
  "Detecting floors and rooms…",
  "Estimating devices from the layout…",
  "Almost done…",
];

// Editable device columns: [room key, short header].
type NumKey = "workstations" | "wifi_devices" | "printers" | "cameras" | "servers";
const FIELDS: [NumKey, string][] = [
  ["workstations", "WS"],
  ["wifi_devices", "WiFi"],
  ["printers", "Pr"],
  ["cameras", "Cam"],
  ["servers", "Srv"],
];

/** Pull a human-readable message out of a raw (often JSON) error string. */
function cleanError(err?: string | null): string {
  if (!err) return "No floors or rooms could be detected in this file.";
  const m = err.match(/"message"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  return err;
}

const hasDevices = (r: ImportRoom) =>
  r.workstations + r.wifi_devices + r.printers + r.cameras + r.servers > 0;

export default function ImportPlanModal({
  open,
  loading,
  result,
  onClose,
  onApply,
  onRetry,
  onPick,
}: {
  open: boolean;
  loading: boolean;
  result: ImportResult | null;
  onClose: () => void;
  onApply: (floors: ImportFloor[]) => void;
  onRetry: () => void;
  onPick: (file: File) => void;
}) {
  const [skipEmpty, setSkipEmpty] = useState(false);
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editable working copy of what the parser/AI detected — the user reviews and
  // corrects this before it's applied to the project.
  const [draft, setDraft] = useState<ImportFloor[]>([]);
  useEffect(() => {
    if (result?.ok && result.floors.length) setDraft(structuredClone(result.floors));
  }, [result]);

  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200);
    return () => clearInterval(id);
  }, [loading]);

  if (!open) return null;

  function mutate(fn: (d: ImportFloor[]) => void) {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }
  const setRoomName = (fi: number, ri: number, v: string) => mutate((d) => { d[fi].rooms[ri].name = v; });
  const setRoomNum = (fi: number, ri: number, k: NumKey, v: number) =>
    mutate((d) => { d[fi].rooms[ri][k] = Math.max(0, v); });
  const setFloorName = (fi: number, v: string) => mutate((d) => { d[fi].name = v; });
  const delRoom = (fi: number, ri: number) => mutate((d) => { d[fi].rooms.splice(ri, 1); });
  const delFloor = (fi: number) => mutate((d) => { d.splice(fi, 1); });

  const emptyCount = draft.flatMap((f) => f.rooms).filter((r) => !hasDevices(r)).length;
  // What actually gets applied — optionally dropping rooms still left with no devices.
  const applyFloors = skipEmpty
    ? draft.map((f) => ({ ...f, rooms: f.rooms.filter(hasDevices) })).filter((f) => f.rooms.length > 0)
    : draft.filter((f) => f.rooms.length > 0);
  const applyRooms = applyFloors.reduce((s, f) => s + f.rooms.length, 0);
  const failed = !!result && (!result.ok || result.floors.length === 0);

  const pick = (f?: File | null) => { if (f) onPick(f); };
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragDepth.current++; setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragDepth.current--; if (dragDepth.current <= 0) setDragging(false); };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); pick(e.dataTransfer.files?.[0]); };

  return (
    <div className="modal-overlay">
      <div className="modal settings-modal" role="dialog" aria-modal="true">
        <div className="settings-head">
          <div className="modal-title">Import from plan</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Close" disabled={loading}><Icon name="x" size={16} /></button>
        </div>

        {loading ? (
          <div className="import-loading">
            <span className="spinner" />
            <div>
              <div className="import-step">{STEPS[step]}</div>
              <div className="import-substep">Image and PDF plans are read by AI — this can take a few seconds.</div>
            </div>
          </div>
        ) : result && failed ? (
          <>
            <div className="form-error">{cleanError(result.error)}</div>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={onRetry}><Icon name="refresh" size={15} /> Retry</button>
            </div>
          </>
        ) : result ? (
          <>
            <div className="import-summary">
              <span className={`badge ${result.source === "ai" ? "badge-purple" : "badge-blue"}`}>
                {result.source === "ai" ? "AI vision" : "DXF"}
              </span>
              {applyFloors.length} floor{applyFloors.length !== 1 ? "s" : ""} · {applyRooms} room{applyRooms !== 1 ? "s" : ""}
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>Review & edit before adding</span>
            </div>
            {result.warnings?.map((w, i) => <div key={i} className="import-warn">{w}</div>)}

            {emptyCount > 0 && (
              <label className="import-toggle">
                <input type="checkbox" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
                Skip {emptyCount} room{emptyCount !== 1 ? "s" : ""} with no devices (corridors, restrooms, etc.)
              </label>
            )}

            <div className="import-floors">
              {draft.map((f, fi) => (
                <div className="import-floor" key={fi}>
                  <div className="import-floor-h">
                    <Icon name="building" size={14} />
                    <input className="imp-floor-name" value={f.name} onChange={(e) => setFloorName(fi, e.target.value)} aria-label="Floor name" />
                    <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{f.rooms.length} room{f.rooms.length !== 1 ? "s" : ""}</span>
                    {draft.length > 1 && (
                      <button className="imp-del" title="Remove floor" onClick={() => delFloor(fi)}><Icon name="trash" size={13} /></button>
                    )}
                  </div>
                  <table className="imp-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Room</th>
                        <th>Area</th>
                        {FIELDS.map(([k, h]) => <th key={String(k)}>{h}</th>)}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.rooms.map((r, ri) => (
                        <tr key={ri} className={hasDevices(r) ? "" : "imp-empty"}>
                          <td><input className="imp-room-name" value={r.name} onChange={(e) => setRoomName(fi, ri, e.target.value)} aria-label="Room name" /></td>
                          <td className="muted" style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.area_m2 ? `${r.area_m2} m²` : "—"}</td>
                          {FIELDS.map(([k]) => (
                            <td key={String(k)}>
                              <input
                                className="imp-num"
                                type="number"
                                min={0}
                                value={r[k] === 0 ? "" : r[k]}
                                placeholder="0"
                                onChange={(e) => setRoomNum(fi, ri, k, parseInt(e.target.value) || 0)}
                                aria-label={`${r.name} ${k}`}
                              />
                            </td>
                          ))}
                          <td><button className="imp-del" title="Remove room" onClick={() => delRoom(fi, ri)}><Icon name="x" size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={applyRooms === 0} onClick={() => onApply(applyFloors)}>
                Add {applyRooms} room{applyRooms !== 1 ? "s" : ""} to project
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`dropzone ${dragging ? "dragover" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input ref={fileRef} type="file" accept=".dxf,.png,.jpg,.jpeg,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
              <span className="dropzone-icon"><Icon name="upload" size={30} /></span>
              <div className="dropzone-title">{dragging ? "Drop to import" : "Drag & drop your plan here"}</div>
              <div className="dropzone-sub">or click to browse</div>
              <div className="dropzone-formats">
                <span className="badge badge-blue">DXF</span>
                <span className="badge badge-purple">PNG · JPG</span>
                <span className="badge badge-purple">PDF</span>
              </div>
            </div>
            <p className="dropzone-note muted">
              We'll auto-detect floors and rooms (and estimate devices). Image/PDF plans are read by AI.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
