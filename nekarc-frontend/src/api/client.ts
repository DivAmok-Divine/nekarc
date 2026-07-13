const BASE = (import.meta as any).env?.VITE_API_URL || "/api";

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function getToken(): string | null {
  return localStorage.getItem("nekarc_access");
}
function getRefreshToken(): string | null {
  return localStorage.getItem("nekarc_refresh");
}
function setTokens(t: { access_token: string; refresh_token: string }) {
  localStorage.setItem("nekarc_access", t.access_token);
  localStorage.setItem("nekarc_refresh", t.refresh_token);
}

// Single-flight token refresh: many requests can 401 at once (e.g. a page load
// firing several calls), but only one /auth/refresh runs — the rest await it.
let refreshPromise: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const rt = getRefreshToken();
  if (!rt) return false;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.access_token || !data?.refresh_token) return false;
      setTokens(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Core fetch. For an authed request that comes back 401, transparently refresh
 * the access token once and retry the original request; only if the refresh
 * itself fails do we hand off to the logout handler. This keeps a session alive
 * across the 30-minute access-token expiry (refresh tokens last 7 days).
 */
async function doFetch(path: string, init: RequestInit, auth: boolean, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers);
  if (auth) {
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && auth && !isRetry && path !== "/auth/refresh") {
    if (await tryRefresh()) return doFetch(path, init, auth, true);
    onUnauthorized?.(); // refresh failed → session is really gone
  } else if (res.status === 401 && auth && isRetry) {
    onUnauthorized?.(); // fresh token still rejected → give up
  }
  return res;
}

interface Options extends RequestInit {
  auth?: boolean;
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { auth = true, headers, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    headers: { "Content-Type": "application/json", ...(headers as Record<string, string>) },
  };
  const res = await doFetch(path, init, auth);
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
  const form = new FormData();
  form.append("file", file);
  const res = await doFetch(path, { method: "POST", body: form }, true);
  if (!res.ok) {
    let d = res.statusText;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") d = j.detail;
      else if (Array.isArray(j.detail)) d = j.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new Error(d);
  }
  return res.json();
}

/** GET that returns a binary blob with auth (e.g. an uploaded plan image). */
export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await doFetch(path, {}, true);
  if (!res.ok) throw new Error("Could not load file");
  return res.blob();
}

/** POST that returns a binary blob (e.g. PDF export). */
export async function apiBlob(path: string, body: unknown): Promise<Blob> {
  const res = await doFetch(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    true,
  );
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}
