import { ImageResponse } from "next/og";

export const alt = "Kunji: digital subscriptions in rupees, paid from your mobile wallet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card WhatsApp and Instagram show for any Kunji link. It says what the
// home page says and nothing more: no prices or products, which change and
// would go stale in a cached preview.
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#f4f2ee",
        color: "#1a1a17",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="72" height="72" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="#3d4433" />
          <g fill="none" stroke="#f4f2ee" strokeWidth="3" strokeLinecap="round">
            <circle cx="10.5" cy="16" r="5" />
            <path d="M15.5 16H26M21.5 16v4.5M26 16v3.5" />
          </g>
        </svg>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>Kunji</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
          Digital subscriptions in rupees
        </div>
        <div style={{ fontSize: 34, lineHeight: 1.35, color: "#5e6059", maxWidth: 960 }}>
          Pay from your mobile wallet. Your login arrives in a private vault only you can open.
        </div>
      </div>
    </div>,
    size,
  );
}
