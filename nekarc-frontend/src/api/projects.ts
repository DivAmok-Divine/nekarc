import { api, apiUpload } from "./client";

export interface ProjectSummary {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  floor_count: number;
  room_count: number;
  device_count: number;
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
};
