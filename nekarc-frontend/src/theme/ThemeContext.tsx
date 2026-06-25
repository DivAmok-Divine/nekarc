import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export type Theme = "system" | "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx>(null as unknown as ThemeCtx);
export const useTheme = () => useContext(Ctx);

/** Apply the theme: "system" removes the attribute so prefers-color-scheme governs. */
function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem("nekarc_theme") as Theme) || "system"
  );

  // Apply whenever it changes (and on first render).
  useEffect(() => {
    apply(theme);
  }, [theme]);

  // When the logged-in user's saved preference loads, adopt it.
  useEffect(() => {
    if (user?.theme && user.theme !== theme) {
      setThemeState(user.theme);
      localStorage.setItem("nekarc_theme", user.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("nekarc_theme", t);
    apply(t);
    // Persist to the account (best-effort) so it follows the user across devices.
    if (user) {
      authApi
        .updateMe({ theme: t })
        .then(() => updateUser({ theme: t }))
        .catch(() => {});
    }
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}
