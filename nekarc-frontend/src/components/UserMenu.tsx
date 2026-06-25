import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Theme } from "../theme/ThemeContext";
import Icon from "./Icon";
import SettingsModal from "./SettingsModal";

const THEMES: { key: Theme; icon: string; label: string }[] = [
  { key: "system", icon: "desktop", label: "System" },
  { key: "light", icon: "sun", label: "Light" },
  { key: "dark", icon: "moon", label: "Dark" },
];

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user?.full_name?.trim()?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <div className="usermenu" ref={ref}>
      <button className="usermenu-trigger" onClick={() => setOpen((o) => !o)} title="Account">
        <span className="avatar">{initial}</span>
        <Icon name="chevron-down" size={14} />
      </button>

      {open && (
        <div className="usermenu-pop">
          <div className="usermenu-head">
            <div className="avatar lg">{initial}</div>
            <div className="usermenu-id">
              {user?.full_name && <div className="usermenu-name">{user.full_name}</div>}
              <div className="usermenu-email">{user?.email}</div>
            </div>
          </div>

          <div className="usermenu-sep" />
          <div className="usermenu-label">Theme</div>
          <div className="theme-seg">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`theme-seg-btn ${theme === t.key ? "active" : ""}`}
                onClick={() => setTheme(t.key)}
                title={t.label}
              >
                <Icon name={t.icon} size={15} />
              </button>
            ))}
          </div>

          <div className="usermenu-sep" />
          <button className="usermenu-item" onClick={() => { setOpen(false); setSettingsOpen(true); }}>
            <Icon name="settings" size={16} /> Settings
          </button>
          <button className="usermenu-item danger" onClick={logout}>
            <Icon name="log-out" size={16} /> Sign out
          </button>
        </div>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
