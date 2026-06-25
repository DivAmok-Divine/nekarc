import { useState } from "react";
import { apiUpload } from "../../api/client";
import type { Project } from "../../engine/types";

/**
 * Building-plan upload. Two paths feed one geometry layer:
 *   1. CAD auto-read (DXF) — server parses rooms via ezdxf/shapely.
 *   2. PNG/JPG trace — user draws room polygons on the image (canvas UI is the next milestone).
 */
export default function FloorPlan({ project, projectId }: { project: Project; projectId: string | number }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("");
    try {
      const asset: any = await apiUpload(`/projects/${projectId}/uploads`, file);
      setStatus(`Uploaded “${asset.filename}” (${asset.kind.toUpperCase()}). ` + (asset.kind === "dxf" ? "Ready for CAD parsing." : "Ready to trace rooms."));
    } catch (ex: any) {
      setStatus(`Upload failed: ${ex.message}`);
    } finally {
      setBusy(false);
    }
  }

  const traced = project.floors.flatMap((f) => f.rooms).filter((r) => r.polygon_json).length;
  const totalRooms = project.floors.flatMap((f) => f.rooms).length;

  return (
    <div>
      <div className="section-h">Building plan → geometry</div>
      <div className="card">
        <p className="muted" style={{ marginBottom: 14 }}>
          Upload a plan so the design can be drawn on the real building. Both paths produce the same
          room geometry the engine uses for placement, cable runs, and AP coverage.
        </p>
        <div className="plan-paths">
          <div className="plan-path">
            <div className="plan-path-h">🏗️ CAD auto-read</div>
            <div className="muted">Upload a <strong>DXF</strong>; the server detects rooms and dimensions automatically.</div>
          </div>
          <div className="plan-path">
            <div className="plan-path-h">🖼️ PNG / JPG trace</div>
            <div className="muted">Upload an image, then trace room boxes onto it. Works with any plan.</div>
          </div>
        </div>
        <label className="upload-btn">
          <input type="file" accept=".png,.jpg,.jpeg,.dxf" onChange={onFile} disabled={busy} hidden />
          {busy ? "Uploading…" : "⬆ Upload plan (PNG, JPG, or DXF)"}
        </label>
        {status && <div className="form-ok" style={{ marginTop: 12 }}>{status}</div>}
      </div>

      <div className="card">
        <div className="row-between">
          <div style={{ fontWeight: 700 }}>Room geometry</div>
          <span className="badge badge-blue">{traced}/{totalRooms} rooms traced</span>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          The interactive trace/parse canvas (react-konva) is the next milestone — uploads are wired and
          stored now, so plans are ready to attach to rooms.
        </p>
      </div>
    </div>
  );
}
