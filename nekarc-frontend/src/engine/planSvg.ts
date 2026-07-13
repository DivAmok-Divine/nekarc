import {
  centroid, coverageRadiusM, dist, metresPerUnit, nearestIdf, parsePoly,
  type Placement, type Pt,
} from "./placement";
import type { Floor } from "./types";

/**
 * Render a floor's plan geometry — traced/parsed rooms plus (if laid out) the
 * device placement and cable runs — to a standalone SVG string. Used by the PDF
 * export, which rasterises it and embeds it. Pure: no DOM, no React.
 */

const ROLE: Record<string, string> = {
  workstations: "#3b82f6", printers: "#8b5cf6", cameras: "#ef4444", servers: "#10b981",
};
const CYAN = "#22d3ee", INDIGO = "#6366f1";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parsePlacement(json?: string | null): Placement | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json);
    if (o && Array.isArray(o.idfs) && Array.isArray(o.aps) && Array.isArray(o.devices)) return o as Placement;
  } catch {
    /* ignore */
  }
  return null;
}

export function buildFloorPlanSvg(floor: Floor): { svg: string; w: number; h: number } | null {
  const rooms = floor.rooms
    .map((r) => ({ r, poly: parsePoly(r.polygon_json) }))
    .filter((x): x is { r: typeof x.r; poly: Pt[] } => x.poly !== null);
  if (!rooms.length) return null;

  const pts = rooms.flatMap((x) => x.poly);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minx = Math.min(...xs), miny = Math.min(...ys), maxx = Math.max(...xs), maxy = Math.max(...ys);
  const pad = Math.max(maxx - minx, maxy - miny) * 0.04 + 1;
  const vx = minx - pad, vy = miny - pad, vw = maxx - minx + 2 * pad, vh = maxy - miny + 2 * pad;
  const span = Math.max(vw, vh);
  const sw = span / 320, font = span / 46, mkr = span / 24; // world-scaled sizes

  const mPerU = metresPerUnit(floor.rooms);
  const placement = parsePlacement(floor.placement_json);
  const horizontal = maxx - minx >= maxy - miny;

  // rooms
  let body = rooms.map(({ r, poly }) => {
    const d = poly.map((p) => p.join(",")).join(" ");
    const [cx, cy] = centroid(poly);
    const label = r.area_m2 ? `${esc(r.name)} · ${r.area_m2} m²` : esc(r.name);
    return `<polygon points="${d}" fill="rgba(59,130,246,0.08)" stroke="#3b82f6" stroke-width="${sw}" stroke-linejoin="round"/>`
      + `<text x="${cx}" y="${cy}" font-size="${font}" fill="#0f172a" text-anchor="middle" font-family="Helvetica,Arial">${label}</text>`;
  }).join("");

  // placement overlay
  if (placement && (placement.aps.length || placement.devices.length || placement.idfs.length)) {
    const chip = (x: number, y: number, w: number, color: string, label: string) => {
      const h = mkr * 0.72;
      return `<g transform="translate(${x - w / 2},${y - h / 2})">`
        + `<rect width="${w}" height="${h}" rx="${h * 0.22}" fill="${color}" stroke="#ffffff" stroke-width="${sw * 0.7}"/>`
        + `<text x="${w / 2}" y="${h * 0.72}" font-size="${h * 0.62}" fill="#ffffff" text-anchor="middle" font-weight="bold" font-family="Helvetica,Arial">${esc(label)}</text>`
        + `</g>`;
    };

    // cable runs (orthogonal, to nearest IDF)
    const links = [
      ...placement.aps.map((it) => ({ it, color: CYAN })),
      ...placement.devices.map((it) => ({ it, color: ROLE[it.kind] || "#64748b" })),
    ];
    const cables = links.map(({ it, color }) => {
      const idf = nearestIdf([it.x, it.y], placement.idfs);
      if (!idf) return "";
      const bend: Pt = horizontal ? [it.x, idf.y] : [idf.x, it.y];
      const len = mPerU ? (dist([it.x, it.y], bend) + dist(bend, [idf.x, idf.y])) * mPerU : null;
      const lab: Pt = [(it.x + bend[0]) / 2, (it.y + bend[1]) / 2];
      return `<polyline points="${it.x},${it.y} ${bend[0]},${bend[1]} ${idf.x},${idf.y}" fill="none" stroke="${color}" stroke-width="${sw * 1.3}" stroke-opacity="0.7" stroke-linejoin="round" stroke-linecap="round"/>`
        + (len != null ? `<text x="${lab[0]}" y="${lab[1]}" font-size="${font * 0.85}" fill="${color}" text-anchor="middle" font-family="Helvetica,Arial">${Math.round(len)} m</text>` : "");
    }).join("");

    const coverage = mPerU
      ? placement.aps.map((a) => `<circle cx="${a.x}" cy="${a.y}" r="${coverageRadiusM / mPerU}" fill="rgba(34,211,238,0.08)" stroke="rgba(34,211,238,0.5)" stroke-width="${sw}" stroke-dasharray="${sw * 2} ${sw * 2}"/>`).join("")
      : "";

    const devices = placement.devices.map((dv) => chip(dv.x, dv.y, mkr * 1.4, ROLE[dv.kind] || "#64748b", String(dv.count))).join("");
    const idfs = placement.idfs.map((f) => chip(f.x, f.y, mkr * 1.9, INDIGO, "IDF")).join("");
    const aps = placement.aps.map((a) => `<circle cx="${a.x}" cy="${a.y}" r="${mkr * 0.42}" fill="${CYAN}" stroke="#ffffff" stroke-width="${sw * 0.7}"/>`).join("");

    body += cables + coverage + devices + idfs + aps;
  }

  const RASTER_W = 1500;
  const w = Math.round(RASTER_W), h = Math.max(1, Math.round((RASTER_W * vh) / vw));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}">`
    + `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`
    + body
    + `</svg>`;
  return { svg, w, h };
}
