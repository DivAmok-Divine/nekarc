import type { Design } from "../../engine/types";

/**
 * Lightweight SVG topology (ported from the original prototype).
 * Planned upgrade: migrate to @xyflow/react for pan/zoom/interactivity.
 */
export default function Diagram({ design, projectName }: { design: Design; projectName: string }) {
  const colW = 230;
  const W = Math.max(680, 60 + design.floors.length * colW);
  const H = 560;
  const cx = W / 2;

  type Node = { x: number; y: number; w: number; label: string; icon: string; color: string; detail?: string };
  type Edge = { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean };
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const NW = 150, NH = 46;

  const router = { x: cx - NW / 2, y: 16 };
  const core = { x: cx - NW / 2, y: 104 };
  nodes.push({ ...router, w: NW, label: "Router / Firewall", icon: "🔒", color: "#ef4444" });
  nodes.push({ ...core, w: NW, label: "Core Switch (L3)", icon: "🔀", color: "#6366f1" });
  edges.push({ x1: cx, y1: router.y + NH, x2: cx, y2: core.y, color: "#6366f1" });

  design.floors.forEach((f, i) => {
    const fx = 40 + i * colW + (colW - NW) / 2 - 40 + 40;
    const sx = 40 + i * colW;
    const swX = sx + (colW - NW) / 2;
    const swY = 210;
    nodes.push({ x: swX, y: swY, w: NW, label: `${f.name} Switch`, icon: "🔌", color: "#3b82f6", detail: `${f.switchSize}p PoE · ${f.subnets.staff}` });
    edges.push({ x1: cx, y1: core.y + NH, x2: swX + NW / 2, y2: swY, color: "#3b82f6" });

    const endpoints: Node[] = [];
    endpoints.push({ x: swX, y: 0, w: NW, label: `${f.aps}× WiFi 6 AP`, icon: "📶", color: "#22d3ee" });
    if (f.ws > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.ws} Workstations`, icon: "💻", color: "#10b981" });
    if (f.pr > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.pr} Printer${f.pr > 1 ? "s" : ""}`, icon: "🖨️", color: "#8b5cf6" });
    if (f.cam > 0) endpoints.push({ x: swX, y: 0, w: NW, label: `${f.cam} Camera${f.cam > 1 ? "s" : ""}`, icon: "📷", color: "#f59e0b" });

    endpoints.forEach((ep, ei) => {
      ep.y = 300 + ei * 62;
      nodes.push(ep);
      edges.push({ x1: swX + NW / 2, y1: swY + NH, x2: ep.x + NW / 2, y2: ep.y, color: ep.color, dash: ei === 0 });
    });
    void fx;
  });

  return (
    <div className="diagram-wrap">
      <div className="diagram-caption muted">{projectName} · {design.floors.length} floors · {design.totalAPs} APs</div>
      <div style={{ overflow: "auto" }}>
        <svg width={W} height={H} xmlns="http://www.w3.org/2000/svg">
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray={e.dash ? "5 3" : undefined} />
          ))}
          {nodes.map((n, i) => (
            <g key={i} transform={`translate(${n.x},${n.y})`}>
              <rect width={n.w} height={NH} rx={8} fill="#131e30" stroke={n.color} strokeWidth={1.5} />
              <text x={12} y={20} fontSize={14}>{n.icon}</text>
              <text x={34} y={20} fontSize={11} fontWeight={700} fill="#e2e8f0">{n.label}</text>
              {n.detail && <text x={12} y={36} fontSize={9} fill="#64748b">{n.detail.slice(0, 30)}</text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
