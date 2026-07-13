import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Icon from "../../components/Icon";
import { PALETTE } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import type { Design, FloorDesign } from "../../engine/types";

const primarySubnet = (f: FloorDesign) =>
  f.subnets.staff || f.subnets.guest || f.subnets.printers || f.subnets.servers || f.subnets.cameras || "";

type DeviceData = { label: string; detail?: string; icon: string; color: string };

// Custom node — a bordered device card with hidden top/bottom connection handles.
function DeviceNode({ data }: NodeProps) {
  const d = data as DeviceData;
  return (
    <div className="flow-node" style={{ borderColor: d.color }}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <span className="flow-node-ico" style={{ color: d.color }}><Icon name={d.icon} size={16} /></span>
      <div className="flow-node-text">
        <div className="flow-node-label">{d.label}</div>
        {d.detail && <div className="flow-node-detail">{d.detail}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}
const nodeTypes = { device: DeviceNode };

const NODE_W = 172;
const COL_W = 240;

function buildGraph(design: Design, active: FloorDesign[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (active.length === 0) return { nodes, edges };

  const dev = (id: string, x: number, y: number, data: DeviceData): Node =>
    ({ id, type: "device", position: { x, y }, data });
  const link = (source: string, target: string, color: string, dashed = false): Edge =>
    ({ id: `${source}->${target}`, source, target, style: { stroke: color, strokeDasharray: dashed ? "6 4" : undefined }, animated: dashed });

  const rowW = active.length * COL_W;
  const cx = rowW / 2 - NODE_W / 2;

  nodes.push(dev("router", cx, 0, { label: "Router / Firewall", detail: `${design.vlans.length} VLAN${design.vlans.length !== 1 ? "s" : ""}`, icon: "shield", color: PALETTE.red }));
  nodes.push(dev("core", cx, 120, { label: "Core Switch (L3)", detail: "Inter-VLAN routing", icon: "switch", color: PALETTE.indigo }));
  edges.push(link("router", "core", PALETTE.indigo));

  active.forEach((f, i) => {
    const colX = i * COL_W + (COL_W - NODE_W) / 2;
    const swId = `sw-${f.id}`;
    nodes.push(dev(swId, colX, 268, { label: `${f.name} Switch`, detail: `${f.switchSize}p PoE · ${primarySubnet(f)}`, icon: "switch", color: PALETTE.blue }));
    edges.push(link("core", swId, PALETTE.blue));

    const eps: DeviceData[] = [];
    if (f.aps > 0) eps.push({ label: `${f.aps}× WiFi 6 AP`, icon: "wifi", color: PALETTE.cyan });
    if (f.ws > 0) eps.push({ label: `${f.ws} Workstation${f.ws > 1 ? "s" : ""}`, icon: "monitor", color: PALETTE.green });
    if (f.pr > 0) eps.push({ label: `${f.pr} Printer${f.pr > 1 ? "s" : ""}`, icon: "printer", color: PALETTE.purple });
    if (f.cam > 0) eps.push({ label: `${f.cam} Camera${f.cam > 1 ? "s" : ""}`, icon: "camera", color: PALETTE.amber });
    if (f.srv > 0) eps.push({ label: `${f.srv} Server${f.srv > 1 ? "s" : ""}`, icon: "server", color: PALETTE.green });

    eps.forEach((ep, ei) => {
      const epId = `${swId}-ep-${ei}`;
      nodes.push(dev(epId, colX, 400 + ei * 84, ep));
      edges.push(link(swId, epId, ep.color, ep.icon === "wifi"));
    });
  });

  return { nodes, edges };
}

/**
 * Interactive topology (pan / zoom / drag) built on @xyflow/react.
 * Only floors with infrastructure are drawn; core gear appears only when the
 * building has something to serve.
 */
export default function Diagram({ design, projectName }: { design: Design; projectName: string }) {
  const { theme } = useTheme();
  const active = useMemo(() => design.floors.filter((f) => f.switchCount > 0), [design]);
  const { nodes, edges } = useMemo(() => buildGraph(design, active), [design, active]);

  return (
    <div className="diagram-wrap">
      <div className="diagram-caption muted">
        {projectName} · {design.floors.length} floor{design.floors.length !== 1 ? "s" : ""} · {design.totalAPs} AP{design.totalAPs !== 1 ? "s" : ""}
        {nodes.length > 0 && <span> · drag to pan, scroll to zoom</span>}
      </div>
      {nodes.length === 0 ? (
        <div className="diagram-empty muted">No devices yet — add some and the topology will appear here.</div>
      ) : (
        <div className="diagram-flow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode={theme}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            nodesConnectable={false}
            defaultEdgeOptions={{ type: "smoothstep" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => (n.data as DeviceData).color} nodeStrokeWidth={2} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
