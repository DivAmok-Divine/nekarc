import { type FormEvent, useState } from "react";
import { authApi } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Theme } from "../theme/ThemeContext";
import { useConfirm } from "./confirm";
import Icon from "./Icon";

const THEMES: { key: Theme; icon: string; label: string }[] = [
  { key: "system", icon: "desktop", label: "System" },
  { key: "light", icon: "sun", label: "Light" },
  { key: "dark", icon: "moon", label: "Dark" },
];

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const confirm = useConfirm();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const profileDirty = fullName.trim() !== (user?.full_name || "").trim();
  const pwReady = curPw.length > 0 && newPw.length > 0 && confirmPw.length > 0;

  if (!open) return null;

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const u = await authApi.updateMe({ full_name: fullName });
      updateUser({ full_name: u.full_name });
      setProfileMsg("Saved");
    } catch {
      setProfileMsg("Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!pwReady || savingPw) return;
    setPwErr("");
    setPwMsg("");
    if (newPw.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPw === curPw) {
      setPwErr("New password must be different from your current password.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr("New passwords don't match.");
      return;
    }

    const ok = await confirm({
      title: "Change password?",
      message: "You'll be signed out and will need to log in again with your new password.",
      confirmLabel: "Change & sign out",
      cancelLabel: "Keep current",
      danger: true,
    });
    if (!ok) return;

    setSavingPw(true);
    try {
      await authApi.changePassword(curPw, newPw);
      // Show a green confirmation on the login page after we sign out.
      sessionStorage.setItem("nekarc_notice", "Password changed successfully. Sign in with your new credentials.");
      logout();
    } catch (ex: any) {
      setPwErr(ex.message || "Could not change password");
      setSavingPw(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <div className="modal-title">Account settings</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Close"><Icon name="x" size={16} /></button>
        </div>

        <div className="settings-section">
          <div className="settings-section-h">Profile</div>
          <label>Email</label>
          <input type="email" value={user?.email || ""} disabled />
          <label>Full name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          <div className="settings-row">
            <button
              className={`btn btn-primary btn-sm ${!profileDirty || savingProfile ? "disabled-soft" : ""}`}
              onClick={() => { if (!profileDirty || savingProfile) return; saveProfile(); }}
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
            {profileMsg && <span className="muted" style={{ fontSize: 12 }}>{profileMsg}</span>}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-h">Appearance</div>
          <div className="theme-seg wide">
            {THEMES.map((t) => (
              <button key={t.key} className={`theme-seg-btn ${theme === t.key ? "active" : ""}`} onClick={() => setTheme(t.key)}>
                <Icon name={t.icon} size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-h">Change password</div>
          <form onSubmit={changePassword}>
            <label>Current password</label>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
            <label>New password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="At least 8 characters" />
            <label>Confirm new password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
            {pwErr && <div className="form-error">{pwErr}</div>}
            {pwMsg && <div className="form-ok">{pwMsg}</div>}
            <div className="settings-row">
              <button type="submit" className={`btn btn-primary btn-sm ${!pwReady || savingPw ? "disabled-soft" : ""}`}>
                {savingPw ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
