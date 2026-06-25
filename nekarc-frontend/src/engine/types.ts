// ── Editable building model (mirrors the backend schema) ──
export interface Room {
  id: string;
  name: string;
  workstations: number;
  wifi_devices: number;
  printers: number;
  cameras: number;
  servers: number;
  polygon_json?: string | null;
  area_m2?: number | null;
}

export interface Floor {
  id: string;
  name: string;
  order_index: number;
  rooms: Room[];
}

export interface Project {
  id?: number;
  name: string;
  floors: Floor[];
}

// ── Computed design output ──
export interface Vlan {
  id: number;
  name: string;
  color: string;
  desc: string;
  dhcp: string;
}

export interface Subnets {
  staff: string;
  guest: string;
  printers: string;
  servers: string | null;
  cameras: string | null;
}

export interface FloorDesign {
  id: string;
  name: string;
  rooms: Room[];
  ws: number;
  wifi: number;
  pr: number;
  cam: number;
  srv: number;
  total: number;
  aps: number;
  switchSize: number;
  switchCount: number;
  needsPoE: boolean;
  portsNeeded: number;
  portsWithHeadroom: number;
  subnets: Subnets;
}

export interface BomItem {
  cat: string;
  item: string;
  qty: number;
  note: string;
}

export interface Design {
  floors: FloorDesign[];
  totalAPs: number;
  totalDev: number;
  totalWS: number;
  switchTotal: number;
  bom: BomItem[];
  vlans: Vlan[];
}
