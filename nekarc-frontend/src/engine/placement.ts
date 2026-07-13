import { AP_COVERAGE_M2 } from "./constants";
import type { FloorDesign, Room } from "./types";

/**
 * Physical device placement on a floor plan. Pure geometry: given the traced
 * rooms and the computed design for a floor, lay out the switch/IDF, access
 * points (by area, for coverage) and wired-device markers — all in the canvas'
 * coordinate space (the same units as room polygon_json). The UI renders these,
 * lets the user drag them, and re-routes cabling to the nearest IDF.
 */

export type Pt = [number, number];
export type DeviceKind = "workstations" | "printers" | "cameras" | "servers";

export interface PlacedItem { id: string; x: number; y: number; }
export interface PlacedDevice extends PlacedItem { kind: DeviceKind; count: number }
export interface Placement {
  idfs: PlacedItem[];
  aps: PlacedItem[];
  devices: PlacedDevice[];
}

export const DEVICE_KINDS: DeviceKind[] = ["workstations", "printers", "cameras", "servers"];

export function parsePoly(json?: string | null): Pt[] | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (Array.isArray(o?.points) && o.points.length >= 3) return o.points as Pt[];
  } catch {
    /* ignore */
  }
  return null;
}

export const polyArea = (pts: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

export const centroid = (pts: Pt[]): Pt => {
  const n = pts.length;
  const s = pts.reduce<Pt>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [s[0] / n, s[1] / n];
};

const bbox = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { minx: Math.min(...xs), miny: Math.min(...ys), maxx: Math.max(...xs), maxy: Math.max(...ys) };
};

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Metres per canvas unit, derived from any room with both a polygon and a real
 * area (works for image-traced and DXF plans alike). null if none is available.
 */
export function metresPerUnit(rooms: Room[]): number | null {
  let areaM2 = 0, areaU = 0;
  for (const r of rooms) {
    const p = parsePoly(r.polygon_json);
    if (p && r.area_m2 && r.area_m2 > 0) { areaM2 += r.area_m2; areaU += polyArea(p); }
  }
  return areaU > 0 && areaM2 > 0 ? Math.sqrt(areaM2 / areaU) : null;
}

/** AP coverage radius in metres (a ~150 m² cell → ~6.9 m radius). */
export const coverageRadiusM = Math.sqrt(AP_COVERAGE_M2 / Math.PI);

// Largest-remainder apportionment: split `total` across weights, summing exactly.
function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const base = raw.map(Math.floor);
  let rem = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as [number, number]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem && order.length; k++) base[order[k % order.length][1]]++;
  return base;
}

// Spread k points across a room's bounding box (grid), for multiple APs in one room.
function spread(poly: Pt[], c: Pt, k: number): Pt[] {
  if (k <= 1) return [c];
  const { minx, miny, maxx, maxy } = bbox(poly);
  const cols = Math.ceil(Math.sqrt(k)), rows = Math.ceil(k / cols);
  const pts: Pt[] = [];
  for (let r = 0; r < rows && pts.length < k; r++)
    for (let cc = 0; cc < cols && pts.length < k; cc++)
      pts.push([minx + ((cc + 1) / (cols + 1)) * (maxx - minx), miny + ((r + 1) / (rows + 1)) * (maxy - miny)]);
  return pts;
}

interface RoomGeo { room: Room; poly: Pt[]; c: Pt; area: number }

/** Auto-layout everything for one floor. Item ids are stable across recomputes. */
export function computePlacement(rooms: Room[], floor: FloorDesign): Placement {
  const geo: RoomGeo[] = rooms
    .map((room) => { const poly = parsePoly(room.polygon_json); return poly ? { room, poly, c: centroid(poly), area: polyArea(poly) } : null; })
    .filter((g): g is RoomGeo => g !== null);

  if (!geo.length) return { idfs: [], aps: [], devices: [] };

  // ── IDFs: split rooms into `idfCount` clusters along the longer axis ──
  const idfCount = Math.max(1, floor.idfCount || 1);
  const { minx, miny, maxx, maxy } = bbox(geo.flatMap((g) => g.poly));
  const horizontal = maxx - minx >= maxy - miny;
  const sorted = [...geo].sort((a, b) => (horizontal ? a.c[0] - b.c[0] : a.c[1] - b.c[1]));
  const clusters: RoomGeo[][] = Array.from({ length: idfCount }, () => []);
  sorted.forEach((g, i) => clusters[Math.floor((i * idfCount) / sorted.length)].push(g));

  const idfs: PlacedItem[] = clusters
    .filter((c) => c.length)
    .map((cl, i) => {
      const wsum = cl.reduce((s, g) => s + g.area, 0) || cl.length;
      const x = cl.reduce((s, g) => s + g.c[0] * g.area, 0) / wsum;
      const y = cl.reduce((s, g) => s + g.c[1] * g.area, 0) / wsum;
      return { id: `idf-${i}`, x, y };
    });

  // ── APs: distribute the floor's AP count across rooms, weighted by area ──
  const apCounts = apportion(geo.map((g) => g.area), floor.aps || 0);
  const aps: PlacedItem[] = [];
  geo.forEach((g, gi) => {
    spread(g.poly, g.c, apCounts[gi]).forEach((p, i) => {
      if (i < apCounts[gi]) aps.push({ id: `ap-${g.room.id}-${i}`, x: p[0], y: p[1] });
    });
  });

  // ── wired-device markers: one per present device-kind per room ──
  const devices: PlacedDevice[] = [];
  geo.forEach((g) => {
    const present = DEVICE_KINDS.filter((k) => (g.room[k] as number) > 0);
    const { minx: bx, maxx: bX } = bbox(g.poly);
    const span = Math.min((bX - bx) * 0.6, (bX - bx));
    present.forEach((k, i) => {
      const dx = present.length > 1 ? (i - (present.length - 1) / 2) * (span / present.length) : 0;
      devices.push({ id: `dev-${g.room.id}-${k}`, kind: k, count: g.room[k] as number, x: g.c[0] + dx, y: g.c[1] });
    });
  });

  return { idfs, aps, devices };
}

/** Overlay saved positions (by id) onto a freshly computed placement, so user
 *  drags survive but new/removed items are handled automatically. */
export function mergePlacement(fresh: Placement, saved: Placement | null | undefined): Placement {
  if (!saved) return fresh;
  const idx = (arr: PlacedItem[]) => new Map(arr.map((i) => [i.id, i]));
  const si = idx(saved.idfs), sa = idx(saved.aps), sd = idx(saved.devices);
  const at = <T extends PlacedItem>(item: T, m: Map<string, PlacedItem>): T => {
    const s = m.get(item.id);
    return s ? { ...item, x: s.x, y: s.y } : item;
  };
  return {
    idfs: fresh.idfs.map((i) => at(i, si)),
    aps: fresh.aps.map((i) => at(i, sa)),
    devices: fresh.devices.map((i) => at(i, sd)),
  };
}

/** Nearest IDF to a point (for drawing/labelling a cable run). */
export function nearestIdf(p: Pt, idfs: PlacedItem[]): PlacedItem | null {
  let best: PlacedItem | null = null, bd = Infinity;
  for (const idf of idfs) { const d = dist(p, [idf.x, idf.y]); if (d < bd) { bd = d; best = idf; } }
  return best;
}
