import { useEffect, useMemo, useRef, useState } from "react";
import { projectsApi, type Asset } from "../../api/projects";
import Icon, { ICONS } from "../../components/Icon";
import { PALETTE, ROLE_COLORS } from "../../theme/colors";
import {
  computePlacement, coverageRadiusM, mergePlacement, metresPerUnit, nearestIdf,
  type DeviceKind, type Placement,
} from "../../engine/placement";
import type { Design, Project, Room } from "../../engine/types";

/**
 * Building-plan → geometry + physical layout. Upload a PNG/JPG plan, calibrate a
 * scale, and trace rooms (saved to area_m2 / polygon_json). With "Design overlay"
 * on, the generated design is auto-placed on the plan — access points (+coverage),
 * the switch/IDF, and wired-device markers — with cable runs to the nearest closet.
 * Everything is draggable and saved per floor (placement_json).
 */

type Pt = [number, number];
type Mode = "pan" | "scale" | "trace";
interface View { x: number; y: number; w: number; h: number }

const parsePoly = (json?: string | null): Pt[] | null => {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (Array.isArray(o?.points) && o.points.length >= 3) return o.points as Pt[];
  } catch {
    /* ignore malformed geometry */
  }
  return null;
};

const parsePlacement = (json?: string | null): Placement | null => {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (o && Array.isArray(o.idfs) && Array.isArray(o.aps) && Array.isArray(o.devices)) return o as Placement;
  } catch {
    /* ignore */
  }
  return null;
};

const shoelace = (pts: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

const centroid = (pts: Pt[]): Pt => {
  const n = pts.length;
  const c = pts.reduce<Pt>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [c[0] / n, c[1] / n];
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const ICON_FOR: Record<DeviceKind, string> = {
  workstations: "monitor", printers: "printer", cameras: "camera", servers: "server",
};

export default function FloorPlan({
  project,
  projectId,
  design,
  onProjectChange,
}: {
  project: Project;
  projectId: string | number;
  design: Design;
  onProjectChange?: (next: Project) => void | Promise<void>;
}) {
  // ── plan image ──
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState<number | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState<number | null>(null); // metres per pixel
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  // ── interaction ──
  const [mode, setMode] = useState<Mode>("pan");
  const [activeFloor, setActiveFloor] = useState(0);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [refLen, setRefLen] = useState(""); // known length (m) for the scale line
  const [view, setView] = useState<View>({ x: 0, y: 0, w: 1, h: 1 });

  // ── geometry being edited (roomId → polygon points, in image pixels) ──
  const [polys, setPolys] = useState<Record<string, Pt[]>>(() => {
    const m: Record<string, Pt[]> = {};
    for (const f of project.floors) for (const r of f.rooms) {
      const p = parsePoly(r.polygon_json);
      if (p) m[r.id] = p;
    }
    return m;
  });
  const initialPolyRooms = useRef<Set<string>>(
    new Set(project.floors.flatMap((f) => f.rooms).filter((r) => parsePoly(r.polygon_json)).map((r) => r.id))
  );
  const [dirty, setDirty] = useState(false);

  // ── design overlay (physical device placement) ──
  const [showDesign, setShowDesign] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [placementDirty, setPlacementDirty] = useState(false);
  const dragItem = useRef<{ kind: "ap" | "idf" | "device"; id: string } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const urlRef = useRef<string>("");

  const floor = project.floors[activeFloor];

  // Rooms with their latest (possibly unsaved) traced polygons folded in.
  const liveRooms = (rooms: Room[]): Room[] =>
    rooms.map((r) => (polys[r.id] ? { ...r, polygon_json: JSON.stringify({ points: polys[r.id] }) } : r));

  // ── load the list of uploaded plans; pick the newest image ──
  useEffect(() => {
    (async () => {
      try {
        const list = await projectsApi.listPlans(projectId);
        setAssets(list);
        const image = list.find((a) => a.kind === "png" || a.kind === "jpg");
        if (image) setAssetId(image.id);
      } catch {
        /* no plans yet */
      }
    })();
  }, [projectId]);

  // ── fetch + decode the selected image ──
  useEffect(() => {
    if (assetId == null) return;
    const asset = assets.find((a) => a.id === assetId);
    setScale(asset?.scale_m_per_px ?? null);
    let cancelled = false;
    (async () => {
      try {
        const blob = await projectsApi.planFileBlob(projectId, assetId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          if (cancelled) return URL.revokeObjectURL(url);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setImgUrl(url);
          setImg({ w: image.naturalWidth, h: image.naturalHeight });
          setView({ x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight });
        };
        image.src = url;
      } catch {
        setStatus("Could not load the plan image.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, assets]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // ── geometry-only mode: no background image, but rooms carry polygons (e.g. a DXF import) ──
  const hasAnyPolys = Object.keys(polys).length > 0;
  const geoOnly = !imgUrl && hasAnyPolys;
  const geoBounds = useMemo(() => {
    if (imgUrl) return null;
    const pts = floor.rooms.flatMap((r) => polys[r.id] || []);
    if (pts.length < 3) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys), maxx = Math.max(...xs), maxy = Math.max(...ys);
    const pad = Math.max(maxx - minx, maxy - miny) * 0.05 + 1;
    return { x: minx - pad, y: miny - pad, w: maxx - minx + 2 * pad, h: maxy - miny + 2 * pad };
  }, [imgUrl, floor.rooms, polys]);
  const fittedFloor = useRef<number | null>(null);
  useEffect(() => {
    if (imgUrl || !geoBounds) return;
    if (fittedFloor.current === activeFloor) return; // refit only when the floor changes
    setView(geoBounds);
    fittedFloor.current = activeFloor;
  }, [imgUrl, geoBounds, activeFloor]);

  // ── (re)compute the placement when entering design mode or switching floor ──
  useEffect(() => {
    if (!showDesign) return;
    const df = design.floors.find((d) => d.id === floor.id) ?? design.floors[activeFloor];
    if (!df) { setPlacement(null); return; }
    const fresh = computePlacement(liveRooms(floor.rooms), df);
    setPlacement(mergePlacement(fresh, parsePlacement(floor.placement_json)));
    setPlacementDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDesign, activeFloor]);

  // ── native non-passive wheel zoom (so we can preventDefault the page scroll) ──
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || (!img && !geoBounds)) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [ix, iy] = toImg(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      const refW = img?.w ?? geoBounds?.w ?? view.w;
      const minW = refW / 30, maxW = refW * 2;
      const newW = Math.max(minW, Math.min(maxW, view.w * factor));
      const newH = view.h * (newW / view.w);
      const fx = (ix - view.x) / view.w, fy = (iy - view.y) / view.h;
      setView({ x: ix - fx * newW, y: iy - fy * newH, w: newW, h: newH });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [img, geoBounds, view]);

  // client px → image px via the SVG's current transform (handles zoom + letterboxing)
  function toImg(clientX: number, clientY: number): Pt {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  // ── uploading a new plan ──
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setStatus("");
    try {
      const asset = await projectsApi.uploadPlan(projectId, file);
      setAssets((prev) => [asset, ...prev]);
      if (asset.kind === "dxf") {
        setStatus(`Uploaded "${asset.filename}". DXF plans are read automatically via “Import plan”.`);
      } else {
        setAssetId(asset.id);
        setStatus(`Uploaded "${asset.filename}". Set a scale, then trace your rooms.`);
      }
    } catch (ex: any) {
      setStatus(`Upload failed: ${ex.message}`);
    } finally {
      setBusy(false);
    }
  }

  // ── pan (bg-drag in pan/design mode, or middle-drag anywhere) ──
  function onPointerDown(e: React.PointerEvent) {
    if (!(showDesign || mode === "pan" || e.button === 1)) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const di = dragItem.current;
    if (di) {
      const [x, y] = toImg(e.clientX, e.clientY);
      setPlacement((prev) => {
        if (!prev) return prev;
        const upd = <T extends { id: string }>(arr: T[]) => arr.map((it) => (it.id === di.id ? { ...it, x, y } : it));
        if (di.kind === "ap") return { ...prev, aps: upd(prev.aps) };
        if (di.kind === "idf") return { ...prev, idfs: upd(prev.idfs) };
        return { ...prev, devices: upd(prev.devices) };
      });
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const rect = svgRef.current!.getBoundingClientRect();
    setView((v) => ({
      ...v,
      x: pan.vx - ((e.clientX - pan.sx) * v.w) / rect.width,
      y: pan.vy - ((e.clientY - pan.sy) * v.h) / rect.height,
    }));
  }
  function onPointerUp() {
    if (dragItem.current) { dragItem.current = null; setPlacementDirty(true); return; }
    panRef.current = null;
  }
  function startItemDrag(e: React.PointerEvent, kind: "ap" | "idf" | "device", id: string) {
    e.stopPropagation();
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragItem.current = { kind, id };
  }

  // ── click places points while tracing / calibrating ──
  function onClickCanvas(e: React.MouseEvent) {
    if (showDesign || mode === "pan" || !img) return;
    const p = toImg(e.clientX, e.clientY);
    if (mode === "scale") {
      setDraft((d) => (d.length >= 2 ? [p] : [...d, p]));
      return;
    }
    if (!activeRoom) { setStatus("Pick a room from the list first."); return; }
    if (draft.length >= 3 && dist(p, draft[0]) < view.w * 0.02) {
      commitPolygon(draft);
    } else {
      setDraft((d) => [...d, p]);
    }
  }

  function commitPolygon(pts: Pt[]) {
    if (!activeRoom || pts.length < 3) return;
    setPolys((m) => ({ ...m, [activeRoom]: pts }));
    setDraft([]);
    setDirty(true);
    setStatus("");
  }

  function applyScale() {
    const meters = parseFloat(refLen);
    if (draft.length < 2 || !(meters > 0)) return;
    const px = dist(draft[0], draft[1]);
    if (px <= 0) return;
    const s = meters / px;
    setScale(s);
    setDraft([]); setRefLen(""); setMode("pan");
    setDirty(true);
    setStatus(`Scale set: 1 px = ${s.toFixed(4)} m.`);
    if (assetId != null) projectsApi.setPlanScale(projectId, assetId, s).catch(() => {});
  }

  function startTrace(roomId: string) {
    setActiveRoom(roomId);
    setDraft([]);
    setMode("trace");
  }
  function clearRoom(roomId: string) {
    setPolys((m) => { const n = { ...m }; delete n[roomId]; return n; });
    if (activeRoom === roomId) setDraft([]);
    setDirty(true);
  }

  function toggleDesign() {
    setShowDesign((s) => {
      if (!s) { setMode("pan"); setDraft([]); }
      return !s;
    });
  }
  function regenerateLayout() {
    const df = design.floors.find((d) => d.id === floor.id) ?? design.floors[activeFloor];
    if (!df) return;
    setPlacement(computePlacement(liveRooms(floor.rooms), df));
    setPlacementDirty(true);
  }

  const shownArea = (r: Room): number | null => {
    const p = polys[r.id];
    if (p && scale) return shoelace(p) * scale * scale;
    return r.area_m2 ?? null;
  };

  async function save() {
    setBusy(true);
    try {
      const next: Project = structuredClone(project);
      for (const f of next.floors) for (const r of f.rooms) {
        const p = polys[r.id];
        if (p) {
          r.polygon_json = JSON.stringify({ points: p });
          const a = scale ? shoelace(p) * scale * scale : null;
          if (a != null) r.area_m2 = Math.round(a * 10) / 10;
        } else {
          r.polygon_json = null;
          if (initialPolyRooms.current.has(r.id)) r.area_m2 = null;
        }
      }
      if (placement) {
        const af = next.floors[activeFloor];
        if (af) af.placement_json = JSON.stringify(placement);
      }
      await onProjectChange?.(next);
      initialPolyRooms.current = new Set(Object.keys(polys));
      setDirty(false);
      setPlacementDirty(false);
      setStatus(showDesign ? "Layout saved." : "Geometry saved.");
    } catch {
      setStatus("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const tracedCount = useMemo(
    () => floor.rooms.filter((r) => polys[r.id]).length,
    [floor.rooms, polys]
  );

  // metres per canvas unit: image calibration if set, else derived from traced areas
  const mPerU = useMemo(
    () => scale ?? metresPerUnit(liveRooms(floor.rooms)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, floor.rooms, polys]
  );
  const coverageU = mPerU ? coverageRadiusM / mPerU : null;

  // Geometry of the active floor's traced rooms: trunk orientation (cables run
  // along the long axis) + a world-scaled unit so cable lines are drawn *on the
  // plan* — thicker, and they grow/shrink as you zoom (unlike screen-constant UI).
  const floorGeo = useMemo(() => {
    const pts = floor.rooms.flatMap((r) => polys[r.id] ?? parsePoly(r.polygon_json) ?? []);
    if (pts.length < 3) return { horizontal: true, span: img?.w ?? 1000 };
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return { horizontal: w >= h, span: Math.max(w, h) };
  }, [floor.rooms, polys, img]);
  const trunkHorizontal = floorGeo.horizontal;
  const worldLine = floorGeo.span / 130; // cable thickness in plan units (scales with zoom)

  // sizes that stay visually constant regardless of zoom
  const u = view.w / 900;
  const dot = 5 * u, line = 2 * u, font = 15 * u;
  const mu = view.w / 460; // larger unit for design-overlay markers (~2× the trace unit)

  // ── nothing to show yet (no image and no traced geometry): upload prompt ──
  if (!imgUrl && !hasAnyPolys) {
    return (
      <div>
        <div className="section-h">Building plan → geometry</div>
        <div className="card">
          <p className="muted" style={{ marginBottom: 14 }}>
            Upload a plan image and trace each room to capture its real floor area — then turn on the
            <strong> Design overlay</strong> to place devices and cabling on the plan. DXF plans are read
            automatically via <strong>Import plan</strong>.
          </p>
          <label className="upload-btn">
            <input type="file" accept=".png,.jpg,.jpeg,.dxf" onChange={onFile} disabled={busy} hidden />
            <Icon name="upload" size={15} /> {busy ? "Uploading…" : "Upload plan (PNG, JPG, or DXF)"}
          </label>
          {status && <div className="form-ok" style={{ marginTop: 12 }}>{status}</div>}
        </div>
      </div>
    );
  }

  const draftClosable = mode === "trace" && draft.length >= 3;
  const modes: Mode[] = showDesign ? ["pan"] : geoOnly ? ["pan", "trace"] : ["pan", "scale", "trace"];

  // colored chip marker (IDF / device): filled with its colour, white icon + label
  const chip = (key: string, x: number, y: number, w: number, color: string, icon: string, label: string,
    kind: "idf" | "device", id: string) => (
    <g key={key} transform={`translate(${x - w / 2},${y - 11 * mu})`} onPointerDown={(e) => startItemDrag(e, kind, id)} style={{ cursor: "grab" }}>
      <rect width={w} height={22 * mu} rx={5 * mu} fill={color} stroke="#ffffff" strokeWidth={mu * 0.9} />
      <svg x={5 * mu} y={4 * mu} width={14 * mu} height={14 * mu} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      <text x={22 * mu} y={16 * mu} fontSize={13 * mu} fontWeight={800} fill="#ffffff">{label}</text>
    </g>
  );

  return (
    <div>
      <div className="section-h">Building plan → geometry</div>

      {/* toolbar */}
      <div className="plan-toolbar">
        <div className="seg">
          {modes.map((m) => (
            <button
              key={m}
              className={`seg-btn ${mode === m ? "active" : ""}`}
              onClick={() => { setMode(m); setDraft([]); }}
              title={m === "pan" ? "Pan & zoom" : m === "scale" ? "Set the real-world scale" : "Trace a room"}
            >
              <Icon name={m === "pan" ? "move" : m === "scale" ? "ruler" : "pencil"} size={14} />
              {m === "pan" ? "Pan" : m === "scale" ? "Set scale" : "Trace"}
            </button>
          ))}
        </div>

        {hasAnyPolys && (
          <button className={`btn btn-sm ${showDesign ? "btn-primary" : "btn-ghost"}`} onClick={toggleDesign} title="Overlay the network design on the plan">
            <Icon name="zap" size={14} /> Design overlay
          </button>
        )}
        {showDesign && (
          <button className="btn btn-ghost btn-sm" onClick={regenerateLayout} title="Re-run auto-placement (discards manual moves on this floor)">
            <Icon name="refresh" size={14} /> Re-generate
          </button>
        )}

        {!showDesign && (
          <span className={`scale-chip ${scale || geoOnly ? "ok" : "warn"}`}>
            <Icon name="ruler" size={13} /> {scale ? `1 px = ${scale.toFixed(4)} m` : geoOnly ? "CAD geometry (real m²)" : "No scale set"}
          </span>
        )}

        <div className="spacer" />

        {!showDesign && assets.filter((a) => a.kind !== "dxf").length > 1 && (
          <select className="plan-select" value={assetId ?? ""} onChange={(e) => setAssetId(Number(e.target.value))}>
            {assets.filter((a) => a.kind !== "dxf").map((a) => (
              <option key={a.id} value={a.id}>{a.filename}</option>
            ))}
          </select>
        )}
        {!showDesign && (
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            <input type="file" accept=".png,.jpg,.jpeg,.dxf" onChange={onFile} disabled={busy} hidden />
            <Icon name="upload" size={14} /> New plan
          </label>
        )}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || (!dirty && !placementDirty)}>
          <Icon name="save" size={14} /> {busy ? "Saving…" : (dirty || placementDirty) ? (showDesign ? "Save layout" : "Save geometry") : "Saved"}
        </button>
      </div>

      {/* hints */}
      {showDesign && (
        <div className="plan-hint" style={{ gap: 12 }}>
          {placement && (placement.aps.length || placement.devices.length || placement.idfs.length) ? (
            <>
              <span>Auto-placed — drag any marker to reposition; cables re-route to the nearest closet.</span>
              <span className="legend"><span className="lg-dot" style={{ background: PALETTE.cyan }} /> AP</span>
              <span className="legend"><span className="lg-dot" style={{ background: PALETTE.indigo }} /> IDF</span>
              <span className="legend"><span className="lg-dot" style={{ background: ROLE_COLORS.workstations }} /> WS</span>
              <span className="legend"><span className="lg-dot" style={{ background: ROLE_COLORS.printers }} /> Printer</span>
              <span className="legend"><span className="lg-dot" style={{ background: ROLE_COLORS.cameras }} /> Camera</span>
              <span className="legend"><span className="lg-dot" style={{ background: ROLE_COLORS.servers }} /> Server</span>
            </>
          ) : (
            <span>No traced rooms on this floor — trace rooms first, then the design can be placed on them.</span>
          )}
        </div>
      )}
      {!showDesign && mode === "scale" && (
        <div className="plan-hint">
          {draft.length < 2 ? (
            <>Click two points along something of known length (a wall, a scale bar), then enter its length.</>
          ) : (
            <span className="row" style={{ gap: 8 }}>
              This line is
              <input className="len-input" type="number" min="0" step="0.1" value={refLen}
                autoFocus placeholder="e.g. 5" onChange={(e) => setRefLen(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyScale()} />
              metres
              <button className="btn btn-primary btn-sm" onClick={applyScale} disabled={!(parseFloat(refLen) > 0)}>Set scale</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft([])}>Redo line</button>
            </span>
          )}
        </div>
      )}
      {!showDesign && mode === "trace" && (
        <div className="plan-hint">
          {!activeRoom ? <>Pick a room on the right, then click to drop each corner.</>
            : <>Tracing <strong>{floor.rooms.find((r) => r.id === activeRoom)?.name}</strong> — click each corner; click the first point (or “Finish”) to close.
              {draftClosable && <button className="btn btn-primary btn-sm" style={{ marginLeft: 10 }} onClick={() => commitPolygon(draft)}>Finish shape</button>}
              {draft.length > 0 && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => setDraft([])}>Cancel</button>}
            </>}
        </div>
      )}

      <div className="plan-layout">
        {/* canvas */}
        <div className={`plan-canvas mode-${showDesign ? "pan" : mode}`}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={onClickCanvas}
          >
            {imgUrl && <image href={imgUrl} x={0} y={0} width={img?.w} height={img?.h} />}

            {/* room polygons (dimmed under the design overlay) */}
            {floor.rooms.map((r) => {
              const p = polys[r.id];
              if (!p) return null;
              const active = r.id === activeRoom;
              const [cx, cy] = centroid(p);
              const a = shownArea(r);
              return (
                <g key={r.id}>
                  <polygon
                    points={p.map((pt) => pt.join(",")).join(" ")}
                    fill={showDesign ? "rgba(96,165,250,0.05)" : active ? "rgba(96,165,250,0.28)" : "rgba(96,165,250,0.14)"}
                    stroke={showDesign ? "rgba(96,165,250,0.4)" : active ? "#60a5fa" : "#3b82f6"}
                    strokeWidth={line}
                    strokeLinejoin="round"
                  />
                  {!showDesign && (
                    <text x={cx} y={cy} fontSize={font} fill="#e5edff" textAnchor="middle"
                      stroke="#0b1220" strokeWidth={font * 0.14} paintOrder="stroke" style={{ pointerEvents: "none" }}>
                      {r.name}{a != null ? ` · ${a.toFixed(1)} m²` : ""}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── design overlay ── */}
            {showDesign && placement && (
              <g>
                {/* cable runs: each AP + device → nearest IDF */}
                {[
                  ...placement.aps.map((it) => ({ it, color: PALETTE.cyan })),
                  ...placement.devices.map((it) => ({ it, color: ROLE_COLORS[it.kind] })),
                ].map(({ it, color }, i) => {
                  const idf = nearestIdf([it.x, it.y], placement.idfs);
                  if (!idf) return null;
                  // Orthogonal route: drop off the device, run along the trunk to the closet.
                  const bend: Pt = trunkHorizontal ? [it.x, idf.y] : [idf.x, it.y];
                  const path: Pt[] = [[it.x, it.y], bend, [idf.x, idf.y]];
                  const len = mPerU ? (dist([it.x, it.y], bend) + dist(bend, [idf.x, idf.y])) * mPerU : null;
                  const lab: Pt = [(it.x + bend[0]) / 2, (it.y + bend[1]) / 2];
                  return (
                    <g key={`cbl-${i}`}>
                      <polyline points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke={color}
                        strokeWidth={worldLine} strokeOpacity={0.75} strokeLinejoin="round" strokeLinecap="round" style={{ pointerEvents: "none" }} />
                      {len != null && (
                        <text x={lab[0]} y={lab[1]} fontSize={12 * mu} fill={color}
                          textAnchor="middle" stroke="#0b1220" strokeWidth={mu * 2} paintOrder="stroke" style={{ pointerEvents: "none" }}>
                          {Math.round(len)} m
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* AP coverage circles */}
                {coverageU != null && placement.aps.map((a) => (
                  <circle key={`cov-${a.id}`} cx={a.x} cy={a.y} r={coverageU}
                    fill="rgba(34,211,238,0.10)" stroke="rgba(34,211,238,0.55)" strokeWidth={mu * 0.6}
                    strokeDasharray={`${mu * 2} ${mu * 2}`} style={{ pointerEvents: "none" }} />
                ))}

                {/* device markers */}
                {placement.devices.map((d) =>
                  chip(d.id, d.x, d.y, 40 * mu, ROLE_COLORS[d.kind], ICON_FOR[d.kind], String(d.count), "device", d.id))}

                {/* IDFs */}
                {placement.idfs.map((idf) =>
                  chip(idf.id, idf.x, idf.y, 54 * mu, PALETTE.indigo, "server", "IDF", "idf", idf.id))}

                {/* APs (cyan dot + wifi glyph) */}
                {placement.aps.map((a) => (
                  <g key={a.id} onPointerDown={(e) => startItemDrag(e, "ap", a.id)} style={{ cursor: "grab" }}>
                    <circle cx={a.x} cy={a.y} r={11 * mu} fill={PALETTE.cyan} stroke="#ffffff" strokeWidth={mu} />
                    <svg x={a.x - 7 * mu} y={a.y - 7 * mu} width={14 * mu} height={14 * mu} viewBox="0 0 24 24" fill="none" stroke="#0b1220" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">{ICONS["wifi"]}</svg>
                  </g>
                ))}
              </g>
            )}

            {/* in-progress trace */}
            {mode === "trace" && draft.length > 0 && (
              <g>
                <polyline points={draft.map((pt) => pt.join(",")).join(" ")}
                  fill="none" stroke="#f59e0b" strokeWidth={line} strokeDasharray={`${line * 2} ${line * 2}`} />
                {draft.map((pt, i) => (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={dot} fill={i === 0 ? "#f59e0b" : "#fbbf24"} stroke="#0b1220" strokeWidth={line * 0.5} />
                ))}
              </g>
            )}

            {/* scale line */}
            {mode === "scale" && draft.length > 0 && (
              <g>
                {draft.length === 2 && (
                  <line x1={draft[0][0]} y1={draft[0][1]} x2={draft[1][0]} y2={draft[1][1]}
                    stroke="#34d399" strokeWidth={line} />
                )}
                {draft.map((pt, i) => (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={dot} fill="#34d399" stroke="#0b1220" strokeWidth={line * 0.5} />
                ))}
              </g>
            )}
          </svg>
        </div>

        {/* side panel */}
        <aside className="plan-rooms">
          <div className="pr-head">
            {project.floors.length > 1 && (
              <select className="plan-select" value={activeFloor}
                onChange={(e) => { setActiveFloor(Number(e.target.value)); setActiveRoom(null); setDraft([]); }}>
                {project.floors.map((f, i) => <option key={f.id} value={i}>{f.name}</option>)}
              </select>
            )}
            <span className="badge badge-blue">{tracedCount}/{floor.rooms.length} traced</span>
          </div>

          {showDesign ? (
            <div className="pr-list" style={{ fontSize: 13 }}>
              {(() => {
                const df = design.floors.find((d) => d.id === floor.id) ?? design.floors[activeFloor];
                if (!df) return <p className="muted">No design for this floor.</p>;
                const rows: [string, number | string][] = [
                  ["Access points", df.aps],
                  ["Wiring closets (IDF)", df.idfCount],
                  ["Switch", df.switchCount > 0 ? `${df.switchSize}-port` : "—"],
                  ["Est. cable", df.cableM ? `${df.cableM.toLocaleString()} m` : "—"],
                ];
                return rows.map(([l, v]) => (
                  <div key={l} className="row-between" style={{ padding: "5px 2px" }}>
                    <span className="muted">{l}</span><span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <>
              <div className="pr-list">
                {floor.rooms.map((r: Room) => {
                  const a = shownArea(r);
                  const has = !!polys[r.id];
                  return (
                    <div key={r.id} className={`pr-item ${r.id === activeRoom ? "active" : ""}`}>
                      <button className="pr-main" onClick={() => startTrace(r.id)} title="Trace this room">
                        <span className={`pr-dot ${has ? "on" : ""}`} />
                        <span className="pr-name">{r.name}</span>
                        <span className="pr-area">{has ? (a != null ? `${a.toFixed(1)} m²` : "no scale") : "—"}</span>
                      </button>
                      {has && (
                        <button className="pr-clear" onClick={() => clearRoom(r.id)} title="Clear polygon">
                          <Icon name="x" size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!scale && !geoOnly && (
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Tip: use <strong>Set scale</strong> before tracing so areas come out in real metres.
                </p>
              )}
            </>
          )}
        </aside>
      </div>

      {status && <div className="form-ok" style={{ marginTop: 12 }}>{status}</div>}
    </div>
  );
}
