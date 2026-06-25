export default function Brand({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden>
        <defs>
          <linearGradient id="bgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="112" height="112" rx="30" fill="#0b1120" stroke="url(#bgrad)" strokeWidth="3" />
        <g stroke="url(#bgrad)" strokeWidth="3" strokeOpacity="0.6">
          <line x1="64" y1="100" x2="42" y2="72" />
          <line x1="64" y1="100" x2="86" y2="72" />
          <line x1="42" y1="72" x2="28" y2="46" />
          <line x1="42" y1="72" x2="48" y2="38" />
          <line x1="42" y1="72" x2="64" y2="34" />
          <line x1="86" y1="72" x2="64" y2="34" />
          <line x1="86" y1="72" x2="80" y2="38" />
          <line x1="86" y1="72" x2="100" y2="46" />
        </g>
        <g fill="url(#bgrad)">
          <circle cx="64" cy="100" r="9" />
          <circle cx="42" cy="72" r="7" />
          <circle cx="86" cy="72" r="7" />
          <circle cx="28" cy="46" r="6" />
          <circle cx="48" cy="38" r="6" />
          <circle cx="64" cy="34" r="6" />
          <circle cx="80" cy="38" r="6" />
          <circle cx="100" cy="46" r="6" />
        </g>
      </svg>
      <span style={{ fontSize: size * 0.7, fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>
        nek<span style={{ color: "#60a5fa" }}>arc</span>
      </span>
    </span>
  );
}
