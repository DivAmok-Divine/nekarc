import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import { authApi } from "../../api/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link.">
      {sent ? (
        <div className="form-ok">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            In dev, the link is printed to the backend console.
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <div className="auth-links">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
