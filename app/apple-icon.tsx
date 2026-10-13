import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The same key as icon.svg. iOS wants a PNG for the home screen and adds its
// own rounded corners, so this one is a full square.
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#3d4433",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 32 32">
        <g fill="none" stroke="#f4f2ee" strokeWidth="3" strokeLinecap="round">
          <circle cx="10.5" cy="16" r="5" />
          <path d="M15.5 16H26M21.5 16v4.5M26 16v3.5" />
        </g>
      </svg>
    </div>,
    size,
  );
}
