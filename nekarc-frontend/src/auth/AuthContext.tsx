import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, type User } from "../api/auth";
import { setUnauthorizedHandler } from "../api/client";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

function storeTokens(t: { access_token: string; refresh_token: string }) {
  localStorage.setItem("nekarc_access", t.access_token);
  localStorage.setItem("nekarc_refresh", t.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("nekarc_access");
  localStorage.removeItem("nekarc_refresh");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens();
      setUser(null);
    });
    (async () => {
      if (!localStorage.getItem("nekarc_access")) {
        setLoading(false);
        return;
      }
      try {
        setUser(await authApi.me());
      } catch {
        clearTokens();
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    storeTokens(await authApi.login(email, password));
    setUser(await authApi.me());
  }

  async function register(email: string, password: string, fullName: string) {
    storeTokens(await authApi.register(email, password, fullName));
    setUser(await authApi.me());
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  function updateUser(patch: Partial<User>) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  );
}
