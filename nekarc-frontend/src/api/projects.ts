import { api, apiGetBlob, apiUpload } from "./client";

export interface ProjectSummary {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  floor_count: number;
  room_count: number;
  device_count: number;
}

export interface Asset {
  id: number;
  kind: "png" | "jpg" | "dxf";
  filename: string;
  scale_m_per_px: number | null;
  created_at: string;
}

export const projectsApi = {
  list: () => api<ProjectSummary[]>("/projects"),
  get: (id: number | string) => api(`/projects/${id}`),
  create: (data: unknown) =>
    api("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number | string, data: unknown) =>
    api(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: number | string) =>
    api(`/projects/${id}`, { method: "DELETE" }),
  importPlan: (file: File) => apiUpload(`/import`, file),

  // ── building-plan assets (for the floor-plan trace canvas) ──
  uploadPlan: (projectId: number | string, file: File) =>
    apiUpload<Asset>(`/projects/${projectId}/uploads`, file),
  listPlans: (projectId: number | string) =>
    api<Asset[]>(`/projects/${projectId}/uploads`),
  planFileBlob: (projectId: number | string, assetId: number) =>
    apiGetBlob(`/projects/${projectId}/uploads/${assetId}/file`),
  setPlanScale: (projectId: number | string, assetId: number, scale_m_per_px: number) =>
    api<Asset>(`/projects/${projectId}/uploads/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ scale_m_per_px }),
    }),
};
