import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c0e",
          color: "#5ccfa0",
          fontSize: 40,
          fontWeight: 700,
          fontFamily: "ui-monospace, Menlo, monospace",
          borderRadius: 12,
        }}
      >
        vi
      </div>
    ),
    size,
  );
}
