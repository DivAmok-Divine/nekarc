import { useState } from "react";
import { apiBlob } from "../../api/client";
import Icon from "../../components/Icon";
import type { Design, Project } from "../../engine/types";
import Diagram from "./Diagram";
import FloorPlan from "./FloorPlan";

type Tab = "diagram" | "floorplan" | "bom" | "ip" | "vlans" | "summary" | "refs";
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "diagram", icon: "map", label: "Diagram" },
  { key: "floorplan", icon: "layout", label: "Floor Plan" },
  { key: "bom", icon: "box", label: "Equipment" },
  { key: "ip", icon: "globe", label: "IP Plan" },
  { key: "vlans", icon: "shuffle", label: "VLANs" },
  { key: "summary", icon: "bar-chart", label: "Summary" },
  { key: "refs", icon: "book", label: "References" },
];

export default function ResultsView({
  project,
  design,
  projectId,
}: {
  project: Project;
  design: Design;
  projectId: string | number;
}) {
  const [tab, setTab] = useState<Tab>("diagram");
  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const report = {
        totals: {
          building: project.name,
          floors: design.floors.length,
          total_devices: design.totalDev,
          access_points: design.totalAPs,
          access_switches: design.switchTotal,
        },
        floors: design.floors.map((f) => ({ name: f.name, ws: f.ws, wifi: f.wifi, aps: f.aps })),
        bom: design.bom,
        vlans: design.vlans.map((v) => ({ id: v.id, name: v.name, dhcp: v.dhcp })),
      };
      const blob = await apiBlob(`/projects/${projectId}/export/pdf`, report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, "-")}-network-design.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  const stats: [string, number][] = [
    ["Floors", design.floors.length],
    ["Devices", design.totalDev],
    ["Access Points", design.totalAPs],
    ["Switches", design.switchTotal + 1],
    ["VLANs", design.vlans.length],
    ["BOM Items", design.bom.length],
  ];

  return (
    <div className="results">
      <div className="stat-bar">
        {stats.map(([l, v]) => (
          <div className="stat" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value">{v}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn btn-green btn-sm" onClick={exportPdf} disabled={exporting}>
          <Icon name="download" size={15} /> {exporting ? "…" : "Export PDF"}
        </button>
      </div>

      <div className="tab-body">
        {tab === "diagram" && <Diagram design={design} projectName={project.name} />}
        {tab === "floorplan" && <FloorPlan project={project} projectId={projectId} />}
        {tab === "bom" && <Bom design={design} />}
        {tab === "ip" && <Ip design={design} />}
        {tab === "vlans" && <Vlans design={design} />}
        {tab === "summary" && <Summary design={design} />}
        {tab === "refs" && <Refs />}
      </div>
    </div>
  );
}

function Bom({ design }: { design: Design }) {
  return (
    <div>
      <div className="section-h">Bill of Materials</div>
      <table>
        <thead>
          <tr><th>Category</th><th>Item</th><th>Qty</th><th>Notes / Standard</th></tr>
        </thead>
        <tbody>
          {design.bom.map((row, i) => (
            <tr key={i}>
              <td><span className="badge badge-blue">{row.cat}</span></td>
              <td style={{ fontWeight: 500 }}>{row.item}</td>
              <td style={{ fontWeight: 800, color: "var(--accent2)", fontSize: 16 }}>{row.qty}</td>
              <td className="muted" style={{ fontSize: 12 }}>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ip({ design }: { design: Design }) {
  return (
    <div>
      <div className="section-h">IP Plan — RFC 1918 · /24 per VLAN per floor</div>
      {design.floors.map((f) => {
        const rows = [
          { vlan: 10, name: "Staff", sub: f.subnets.staff },
          { vlan: 20, name: "Guest", sub: f.subnets.guest },
          { vlan: 30, name: "Printers", sub: f.subnets.printers },
          ...(f.subnets.servers ? [{ vlan: 40, name: "Servers", sub: f.subnets.servers }] : []),
          ...(f.subnets.cameras ? [{ vlan: 50, name: "Cameras", sub: f.subnets.cameras }] : []),
        ];
        return (
          <div className="card" key={f.id}>
            <div className="card-title"><Icon name="building" size={15} /> {f.name}</div>
            <table>
              <thead>
                <tr><th>VLAN</th><th>Segment</th><th>Subnet</th><th>Gateway</th><th>Usable Range</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const base = r.sub.split(".").slice(0, 3).join(".");
                  return (
                    <tr key={r.vlan}>
                      <td><span className="badge badge-purple">VLAN {r.vlan}</span></td>
                      <td>{r.name}</td>
                      <td className="mono">{r.sub}</td>
                      <td className="mono">{base}.1</td>
                      <td className="mono muted">{base}.2 – {base}.254</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Vlans({ design }: { design: Design }) {
  return (
    <div>
      <div className="section-h">VLAN Segmentation Plan</div>
      <div className="vlan-grid">
        {design.vlans.map((v) => (
          <div className="card" key={v.id} style={{ borderLeft: `3px solid ${v.color}` }}>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span style={{ background: `${v.color}22`, color: v.color, padding: "2px 10px", borderRadius: 6, fontWeight: 800, fontSize: 13 }}>VLAN {v.id}</span>
              <span style={{ fontWeight: 600 }}>{v.name}</span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{v.desc}</p>
            <div className="muted" style={{ fontSize: 12 }}>DHCP: <span style={{ color: "var(--text)" }}>{v.dhcp}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ design }: { design: Design }) {
  return (
    <div>
      <div className="section-h">Floor-by-Floor Summary</div>
      {design.floors.map((f) => {
        const items: [string, string, string | number][] = [
          ["monitor", "Workstations", f.ws],
          ["wifi", "WiFi Devices", f.wifi],
          ["printer", "Printers", f.pr],
          ["camera", "Cameras", f.cam],
          ["server", "Servers", f.srv],
          ["wifi", "APs", f.aps],
          ["switch", "Switch", `${f.switchSize}p`],
          ["switch", "Ports", f.portsWithHeadroom],
        ];
        return (
          <div className="card" key={f.id}>
            <div className="card-title"><Icon name="building" size={15} /> {f.name}</div>
            <div className="mini-grid">
              {items.map(([ic, label, v], i) => (
                <div className="stat" key={i}>
                  <div className="stat-label"><Icon name={ic} size={12} /> {label}</div>
                  <div className="stat-value" style={{ fontSize: 17 }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {f.needsPoE && <span className="badge badge-amber" style={{ marginRight: 8 }}>PoE Required</span>}
              Staff subnet: <span className="mono">{f.subnets.staff}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Refs() {
  const refs: [string, string][] = [
    ["IEEE 802.11ax-2021", "High Efficiency Wireless LAN (Wi-Fi 6) — AP capacity (20 active devices/AP)."],
    ["TIA-568-D", "Commercial Building Telecommunications Infrastructure — Cat6A cabling, patch panels."],
    ["RFC 1918", "Address Allocation for Private Internets — 192.168.x.x for all subnets."],
    ["Cisco Design Zone", "Enterprise Network Design Guide — switch sizing, core/distribution/access hierarchy."],
    ["BICSI TDMM 14th Ed.", "Telecommunications Distribution Methods Manual — IDF/MDF rack design."],
  ];
  return (
    <div>
      <div className="section-h">Standards & References</div>
      <ul className="ref-list">
        {refs.map(([std, desc]) => (
          <li key={std}><strong>{std}</strong> — {desc}</li>
        ))}
      </ul>
    </div>
  );
}
