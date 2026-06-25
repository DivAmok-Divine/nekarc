const BASE = import.meta.env.VITE_API_URL || "/api";

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function getToken(): string | null {
  return localStorage.getItem("nekarc_access");
}

interface Options extends RequestInit {
  auth?: boolean;
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { auth = true, headers, ...rest } = opts;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };
  if (auth) {
    const t = getToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...rest, headers: h });
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    let detail: string = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Multipart upload (lets the browser set the Content-Type/boundary). */
export async function apiUpload<T = any>(path: string, file: File): Promise<T> {
  const t = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: form,
  });
  if (!res.ok) {
    let d = res.statusText;
    try {
      const j = await res.json();
      d = j.detail || d;
    } catch {
      /* ignore */
    }
    throw new Error(d);
  }
  return res.json();
}

/** POST that returns a binary blob (e.g. PDF export). */
export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  const t = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}
