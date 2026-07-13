import {
  AP_COVERAGE_M2, CABLE_AVG_RUN_FACTOR, CABLE_BOX_M, CABLE_MAX_RUN_FACTOR,
  CABLE_MAX_RUN_M, CABLE_SLACK_M, DEVICES_PER_AP, HEADROOM, UPLINK_PORTS, VLANS,
} from "./constants";
import type { BomItem, Design, FloorDesign, Project } from "./types";

/**
 * The core transformation: building description -> network design.
 * Demand-driven — no artificial minimums. Zero devices -> (nearly) empty design.
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

    // ── geometry (only when rooms carry a traced area_m2; 0 otherwise) ──
    const areaM2 = floor.rooms.reduce((s, r) => s + (r.area_m2 && r.area_m2 > 0 ? r.area_m2 : 0), 0);
    const hasGeom = areaM2 > 0;
    const side = Math.sqrt(areaM2); // equivalent-square floor side, metres
    const avgRunM = hasGeom ? side * CABLE_AVG_RUN_FACTOR + CABLE_SLACK_M : 0;
    const maxRunM = hasGeom ? side * CABLE_MAX_RUN_FACTOR + CABLE_SLACK_M : 0;

    // No WiFi -> no AP. Coverage can only *raise* the count where WiFi is demanded.
    const apsCapacity = Math.ceil(wifi / DEVICES_PER_AP);
    const apsCoverage = wifi > 0 && hasGeom ? Math.ceil(areaM2 / AP_COVERAGE_M2) : 0;
    const aps = wifi > 0 ? Math.max(apsCapacity, apsCoverage) : 0;

    const wired = ws + pr + cam + srv + aps;
    const hasWired = wired > 0;
    const portsWithHeadroom = hasWired ? Math.ceil(wired * HEADROOM) + UPLINK_PORTS : 0;
    const switchSize = hasWired ? (portsWithHeadroom <= 24 ? 24 : 48) : 0;
    const switchCount = hasWired ? Math.ceil(portsWithHeadroom / switchSize) : 0;
    const base = (fi + 1) * 10;

    // One IDF per floor by default; a floor too large for a 90 m horizontal run needs more.
    const idfCount = hasWired ? Math.max(1, Math.ceil((maxRunM || 1) / CABLE_MAX_RUN_M)) : 0;
    const cableM = hasGeom && hasWired ? Math.round(wired * avgRunM) : 0;

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
      areaM2,
      apsCapacity,
      apsCoverage,
      idfCount,
      cableM,
      avgRunM,
      maxRunM,
      runExceedsLimit: hasGeom && maxRunM > CABLE_MAX_RUN_M,
      // Only allocate a subnet for segments this floor actually has.
      subnets: {
        staff: ws > 0 ? `192.168.${base}.0/24` : null,
        guest: wifi > 0 ? `192.168.${base + 1}.0/24` : null,
        printers: pr > 0 ? `192.168.${base + 2}.0/24` : null,
        servers: srv > 0 ? `192.168.${base + 3}.0/24` : null,
        cameras: cam > 0 ? `192.168.${base + 4}.0/24` : null,
      },
    };
  });

  const sum = (fn: (f: FloorDesign) => number) => floors.reduce((s, f) => s + fn(f), 0);
  const totalAPs = sum((f) => f.aps);
  const totalWS = sum((f) => f.ws);
  const totalWifi = sum((f) => f.wifi);
  const totalPr = sum((f) => f.pr);
  const totalCam = sum((f) => f.cam);
  const totalSrv = sum((f) => f.srv);
  const totalDev = sum((f) => f.total);
  const switchTotal = sum((f) => f.switchCount);
  const activeFloors = floors.filter((f) => f.switchCount > 0).length;
  const hasAnyDevice = totalDev > 0;

  // ── geometry-aware aggregates ──
  const totalAreaM2 = sum((f) => f.areaM2);
  const totalCableM = sum((f) => f.cableM);
  const hasGeometry = totalAreaM2 > 0;
  // IDFs drive the horizontal-distribution BOM. Without geometry this equals the
  // active-floor count (one closet per floor), so the output is unchanged.
  const idfTotal = sum((f) => f.idfCount);
  const cableBoxes = Math.ceil(totalCableM / CABLE_BOX_M);

  // Build all candidate lines, then drop any with zero quantity.
  const candidates: BomItem[] = [
    ...(hasAnyDevice
      ? [
          { cat: "Core", item: "Enterprise Router / Firewall", qty: 1, note: "All VLANs terminate here" },
          { cat: "Core", item: "Core Switch (Layer 3)", qty: 1, note: "SFP+ uplinks · Inter-VLAN routing" },
          { cat: "Core", item: "UPS (Uninterruptible Power)", qty: 1, note: "MDF / server room protection" },
        ]
      : []),
    { cat: "Floors", item: "Access Switch (PoE)", qty: switchTotal, note: "1+ per active floor · PoE for APs & cameras" },
    { cat: "Wireless", item: "WiFi 6 Access Point (802.11ax)", qty: totalAPs, note: hasGeometry ? "Max of client-capacity & area-coverage (≤150 m²/AP)" : "1 per 20 active WiFi devices" },
    { cat: "Cabling", item: "Cat6A Patch Cables", qty: Math.ceil(totalWS * 1.1), note: "TIA-568-D · ≥10GbE" },
    ...(hasGeometry
      ? [{ cat: "Cabling", item: "Cat6A Horizontal Cable (305 m box)", qty: cableBoxes, note: `≈ ${totalCableM.toLocaleString()} m of runs · TIA-568-D horizontal` }]
      : []),
    { cat: "Cabling", item: "Patch Panel (24-port)", qty: idfTotal, note: hasGeometry ? "1 per IDF (extra IDFs where runs exceed 90 m)" : "1 per active floor IDF" },
    { cat: "Cabling", item: "Fiber Uplink OM4", qty: idfTotal, note: "IDF switch → core backbone" },
    { cat: "Rack", item: '19" Server Rack', qty: idfTotal > 0 ? Math.max(1, Math.ceil(idfTotal / 2)) : 0, note: "IDF per 1–2 wiring closets" },
    ...(totalPr > 0 ? [{ cat: "Endpoints", item: "Network Printers", qty: totalPr, note: "VLAN 30 segment" }] : []),
    ...(totalCam > 0 ? [{ cat: "Security", item: "IP Cameras + NVR", qty: totalCam, note: "VLAN 50 segment" }] : []),
    ...(totalSrv > 0 ? [{ cat: "Servers", item: "On-premise Servers", qty: totalSrv, note: "VLAN 40 segment" }] : []),
  ];
  const bom = candidates.filter((b) => b.qty > 0);

  // Only show VLAN segments that actually have devices.
  const used = new Set<number>();
  if (totalWS > 0) used.add(10);
  if (totalWifi > 0) used.add(20);
  if (totalPr > 0) used.add(30);
  if (totalSrv > 0) used.add(40);
  if (totalCam > 0) used.add(50);
  const vlans = VLANS.filter((v) => used.has(v.id));

  return {
    floors, totalAPs, totalDev, totalWS, switchTotal, bom, vlans,
    hasGeometry, totalAreaM2, totalCableM, idfTotal,
  };
}
