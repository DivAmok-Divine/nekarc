import type { Vlan } from "./types";
import { PALETTE } from "../theme/colors";

// ── Engineering assumptions (the domain model) ──
// IEEE 802.11ax · TIA-568-D · RFC 1918
export const DEVICES_PER_AP = 20; // active WiFi clients per Wi-Fi 6 AP
export const HEADROOM = 1.2; // +20% spare switch-port capacity
export const UPLINK_PORTS = 2; // ports reserved per access switch

// ── Geometry-aware sizing (only used when rooms have a traced area_m2) ──
// A Wi-Fi 6 AP covers roughly an 11 m radius cell in a typical office (~150 m²).
export const AP_COVERAGE_M2 = 150;
// Horizontal cable runs are estimated from an equivalent-square floor (side = √area).
// Runs follow walls/ceilings, not straight lines, so a routing factor is applied.
export const CABLE_AVG_RUN_FACTOR = 0.55; // average run ≈ 0.55 × floor side
export const CABLE_MAX_RUN_FACTOR = 0.9; // farthest run ≈ 0.9 × floor side
export const CABLE_SLACK_M = 6; // termination + service-loop slack per drop
export const CABLE_MAX_RUN_M = 90; // TIA-568 horizontal channel limit (needs another IDF beyond)
export const CABLE_BOX_M = 305; // Cat6A reel = 1000 ft ≈ 305 m

export const VLANS: Vlan[] = [
  { id: 10, name: "Staff / Workstations", color: PALETTE.blue, desc: "All wired workstations and staff devices", dhcp: "Dynamic (DHCP)" },
  { id: 20, name: "Guest WiFi", color: PALETTE.amber, desc: "Wireless guests — internet only, isolated from staff", dhcp: "Dynamic (DHCP — captive portal)" },
  { id: 30, name: "Printers", color: PALETTE.purple, desc: "Network printers — restricted to print services", dhcp: "Static preferred" },
  { id: 40, name: "Servers", color: PALETTE.green, desc: "On-premise servers — high trust, monitored", dhcp: "Static" },
  { id: 50, name: "IP Cameras", color: PALETTE.red, desc: "Security cameras — fully isolated, no internet", dhcp: "Static" },
];
