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
  staff: string | null;
  guest: string | null;
  printers: string | null;
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
  // ── geometry-aware (present only when the floor has traced areas) ──
  areaM2: number; // total traced floor area (0 when no rooms are traced)
  apsCapacity: number; // APs required by WiFi client count
  apsCoverage: number; // APs required to cover the floor area (0 without geometry)
  idfCount: number; // wiring closets on this floor (>1 when runs exceed the TIA limit)
  cableM: number; // estimated horizontal Cat6A metres (0 without geometry)
  avgRunM: number; // average cable run length
  maxRunM: number; // farthest cable run length
  runExceedsLimit: boolean; // a run is longer than the TIA 90 m horizontal limit
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
  // ── geometry-aware aggregates ──
  hasGeometry: boolean; // any floor has traced areas
  totalAreaM2: number;
  totalCableM: number;
  idfTotal: number;
}
