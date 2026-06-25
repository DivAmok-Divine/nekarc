import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import { useAuth } from "../../auth/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(email, password, fullName);
      nav("/");
    } catch (ex: any) {
      setErr(ex.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start designing networks in minutes.">
      <form onSubmit={submit}>
        <label>Full name</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <label>Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <div className="auth-links">
        <span className="muted">Already have an account?</span>
        <Link to="/login">Sign in</Link>
      </div>
    </AuthShell>
  );
}
