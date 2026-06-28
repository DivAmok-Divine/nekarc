import { ICONS } from "../../components/Icon";
import { PALETTE } from "../../theme/colors";
import type { Design, FloorDesign } from "../../engine/types";

const primarySubnet = (f: FloorDesign) =>
  f.subnets.staff || f.subnets.guest || f.subnets.printers || f.subnets.servers || f.subnets.cameras || "";

/**
 * Lightweight SVG topology. Only floors with infrastructure are drawn,
 * and the core gear appears only when the building has something to serve.
 */
export default function Diagram({ design, projectName }: { design: Design; projectName: string }) {
  const active = design.floors.filter((f) => f.switchCount > 0);

  const colW = 230;
  const W = Math.max(680, 60 + Math.max(active.length, 1) * colW);
  const H = 560;
  const cx = W / 2;

  type Node = { x: number; y: number; w: number; label: string; icon: string; color: string; detail?: string };
  type Edge = { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean };
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const NW = 150, NH = 46;

  if (active.length > 0) {
    const router = { x: cx - NW / 2, y: 16 };
    const core = { x: cx - NW / 2, y: 104 };
    nodes.push({ ...router, w: NW, label: "Router / Firewall", icon: "shield", color: PALETTE.red });
    nodes.push({ ...core, w: NW, label: "Core Switch (L3)", icon: "switch", color: PALETTE.indigo });
    edges.push({ x1: cx, y1: router.y + NH, x2: cx, y2: core.y, color: PALETTE.indigo });

    active.forEach((f, i) => {
      const sx = 40 + i * colW;
      const swX = sx + (colW - NW) / 2;
      const swY = 210;
      nodes.push({ x: swX, y: swY, w: NW, label: `${f.name} Switch`, icon: "switch", color: PALETTE.blue, detail: `${f.switchSize}p PoE · ${primarySubnet(f)}` });
      edges.push({ x1: cx, y1: core.y + NH, x2: swX + NW / 2, y2: swY, color: PALETTE.blue });

      const endpoints: Node[] = [];
      if (f.aps > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.aps}× WiFi 6 AP`, icon: "wifi", color: PALETTE.cyan });
      if (f.ws > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.ws} Workstations`, icon: "monitor", color: PALETTE.green });
      if (f.pr > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.pr} Printer${f.pr > 1 ? "s" : ""}`, icon: "printer", color: PALETTE.purple });
      if (f.cam > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.cam} Camera${f.cam > 1 ? "s" : ""}`, icon: "camera", color: PALETTE.amber });

      endpoints.forEach((ep, ei) => {
        ep.y = 300 + ei * 62;
        nodes.push(ep);
        edges.push({ x1: swX + NW / 2, y1: swY + NH, x2: ep.x + NW / 2, y2: ep.y, color: ep.color, dash: ep.icon === "wifi" });
      });
    });
  }

  return (
    <div className="diagram-wrap">
      <div className="diagram-caption muted">
        {projectName} · {design.floors.length} floor{design.floors.length !== 1 ? "s" : ""} · {design.totalAPs} AP{design.totalAPs !== 1 ? "s" : ""}
      </div>
      {nodes.length === 0 ? (
        <div className="diagram-empty muted">No devices yet — add some and the topology will appear here.</div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <svg width={W} height={H} xmlns="http://www.w3.org/2000/svg">
            {edges.map((e, i) => (
              <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray={e.dash ? "5 3" : undefined} />
            ))}
            {nodes.map((n, i) => (
              <g key={i} transform={`translate(${n.x},${n.y})`}>
                <rect width={n.w} height={NH} rx={6} fill="var(--surface)" stroke={n.color} strokeWidth={1.5} />
                <svg x={12} y={n.detail ? 8 : NH / 2 - 8} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={n.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[n.icon]}
                </svg>
                <text x={36} y={n.detail ? 19 : NH / 2 + 4} fontSize={11} fontWeight={700} fill="var(--text)">{n.label}</text>
                {n.detail && <text x={36} y={34} fontSize={9} fill="var(--muted)">{n.detail.slice(0, 26)}</text>}
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
