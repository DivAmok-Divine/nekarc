import { DEVICES_PER_AP, HEADROOM, UPLINK_PORTS, VLANS } from "./constants";
import type { BomItem, Design, FloorDesign, Project } from "./types";

/**
 * The core transformation: building description -> network design.
 * Pure function, runs client-side for instant feedback.
 */
export function calcNetwork(project: Project): Design {
  const floors: FloorDesign[] = project.floors.map((floor, fi) => {
    let ws = 0, wifi = 0, pr = 0, cam = 0, srv = 0;
    floor.rooms.forEach((r) => {
      ws += +r.workstations || 0;
      wifi += +r.wifi_devices || 0;
      pr += +r.printers || 0;
      cam += +r.cameras || 0;
      srv += +r.servers || 0;
    });

    const aps = Math.max(1, Math.ceil(wifi / DEVICES_PER_AP));
    const wired = ws + pr + cam + srv + aps;
    const portsWithHeadroom = Math.ceil(wired * HEADROOM) + UPLINK_PORTS;
    const switchSize = portsWithHeadroom <= 24 ? 24 : 48;
    const switchCount = Math.ceil(portsWithHeadroom / switchSize);
    const base = (fi + 1) * 10;

    return {
      id: floor.id,
      name: floor.name,
      rooms: floor.rooms,
      ws, wifi, pr, cam, srv,
      total: ws + wifi + pr + cam + srv,
      aps,
      switchSize,
      switchCount,
      needsPoE: aps > 0 || cam > 0,
      portsNeeded: wired,
      portsWithHeadroom,
      subnets: {
        staff: `192.168.${base}.0/24`,
        guest: `192.168.${base + 1}.0/24`,
        printers: `192.168.${base + 2}.0/24`,
        servers: srv > 0 ? `192.168.${base + 3}.0/24` : null,
        cameras: cam > 0 ? `192.168.${base + 4}.0/24` : null,
      },
    };
  });

  const sum = (fn: (f: FloorDesign) => number) => floors.reduce((s, f) => s + fn(f), 0);
  const totalAPs = sum((f) => f.aps);
  const totalWS = sum((f) => f.ws);
  const totalPr = sum((f) => f.pr);
  const totalCam = sum((f) => f.cam);
  const totalSrv = sum((f) => f.srv);
  const totalDev = sum((f) => f.total);
  const switchTotal = sum((f) => f.switchCount);
  const nFloors = project.floors.length;

  const bom: BomItem[] = [
    { cat: "Core", item: "Enterprise Router / Firewall", qty: 1, note: "All VLANs terminate here" },
    { cat: "Core", item: "Core Switch (Layer 3)", qty: 1, note: "48-port, SFP+ uplinks · Inter-VLAN routing" },
    { cat: "Core", item: "UPS (Uninterruptible Power)", qty: 1, note: "MDF / server room protection" },
    { cat: "Floors", item: "Access Switch (PoE)", qty: switchTotal, note: "1+ per floor · PoE for APs & cameras" },
    { cat: "Wireless", item: "WiFi 6 Access Point (802.11ax)", qty: totalAPs, note: "1 per 20 active WiFi devices" },
    { cat: "Cabling", item: "Cat6A Patch Cables", qty: Math.ceil(totalWS * 1.1), note: "TIA-568-D · ≥10GbE" },
    { cat: "Cabling", item: "Patch Panel (24-port)", qty: nFloors, note: "1 per floor IDF" },
    { cat: "Cabling", item: "Fiber Uplink OM4", qty: nFloors, note: "Floor switch → core backbone" },
    { cat: "Rack", item: '19" Server Rack', qty: Math.max(1, Math.ceil(nFloors / 2)), note: "IDF per 1–2 floors" },
    ...(totalPr > 0 ? [{ cat: "Endpoints", item: "Network Printers", qty: totalPr, note: "VLAN 30 segment" }] : []),
    ...(totalCam > 0 ? [{ cat: "Security", item: "IP Cameras + NVR", qty: totalCam, note: "VLAN 50 segment" }] : []),
    ...(totalSrv > 0 ? [{ cat: "Servers", item: "On-premise Servers", qty: totalSrv, note: "VLAN 40 segment" }] : []),
  ];

  return { floors, totalAPs, totalDev, totalWS, switchTotal, bom, vlans: VLANS };
}
