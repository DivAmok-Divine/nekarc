// Single source of truth for the brand palette and device-role colors.
// (Theme colors like bg/surface/text live as CSS variables in index.css;
//  these accent colors are used inside SVG/inline styles where vars are awkward.)

export const PALETTE = {
  blue: "#3b82f6",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  red: "#ef4444",
  green: "#10b981",
  cyan: "#22d3ee",
  indigo: "#6366f1",
} as const;

// Device roles — used by the editor device tiles and the matching VLAN segments.
export const ROLE_COLORS = {
  workstations: PALETTE.blue,
  wifi_devices: PALETTE.amber,
  printers: PALETTE.purple,
  cameras: PALETTE.red,
  servers: PALETTE.green,
} as const;
