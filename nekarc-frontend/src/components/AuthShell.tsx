import { type ReactNode } from "react";
import Brand from "./Brand";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ marginBottom: 18 }}>
          <Brand size={30} />
        </div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
      </div>
      <p className="auth-foot muted">Network Architect — design enterprise LANs from a building description.</p>
    </div>
  );
}
