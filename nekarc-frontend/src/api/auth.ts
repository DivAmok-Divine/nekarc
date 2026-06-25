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
