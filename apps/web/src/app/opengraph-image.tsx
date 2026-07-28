import { ImageResponse } from "next/og";

export const alt = "DevCollab — Real-time collaborative code editor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically generated Open Graph / Twitter card image.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1120 0%, #1e1b4b 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 54,
              fontWeight: 800,
            }}
          >
            {"</>"}
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>
            DevCollab
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 36,
            lineHeight: 1.3,
            color: "#c7d2fe",
            maxWidth: 900,
          }}
        >
          Real-time collaborative code editor — live cursors, shared editing, AI
          assistance, and instant code execution.
        </div>
      </div>
    ),
    { ...size },
  );
}
