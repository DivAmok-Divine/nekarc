import { api } from "./client";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  theme?: "system" | "light" | "dark";
}

export const authApi = {
  register: (email: string, password: string, full_name: string) =>
    api<TokenPair>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    api<TokenPair>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    }),

  me: () => api<User>("/users/me"),

  updateMe: (patch: { theme?: string; full_name?: string }) =>
    api<User>("/users/me", { method: "PATCH", body: JSON.stringify(patch) }),

  changePassword: (current_password: string, new_password: string) =>
    api("/users/me/password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  forgotPassword: (email: string) =>
    api("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, new_password: string) =>
    api("/auth/reset-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ token, new_password }),
    }),
};
