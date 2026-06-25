import type { Vlan } from "./types";

// ── Engineering assumptions (the domain model) ──
// IEEE 802.11ax · TIA-568-D · RFC 1918
export const DEVICES_PER_AP = 20; // active WiFi clients per Wi-Fi 6 AP
export const HEADROOM = 1.2; // +20% spare switch-port capacity
export const UPLINK_PORTS = 2; // ports reserved per access switch

export const VLANS: Vlan[] = [
  { id: 10, name: "Staff / Workstations", color: "#3b82f6", desc: "All wired workstations and staff devices", dhcp: "Dynamic (DHCP)" },
  { id: 20, name: "Guest WiFi", color: "#f59e0b", desc: "Wireless guests — internet only, isolated from staff", dhcp: "Dynamic (DHCP — captive portal)" },
  { id: 30, name: "Printers", color: "#8b5cf6", desc: "Network printers — restricted to print services", dhcp: "Static preferred" },
  { id: 40, name: "Servers", color: "#10b981", desc: "On-premise servers — high trust, monitored", dhcp: "Static" },
  { id: 50, name: "IP Cameras", color: "#ef4444", desc: "Security cameras — fully isolated, no internet", dhcp: "Static" },
];
