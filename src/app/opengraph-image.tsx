import { ImageResponse } from "next/og";

export const alt = "vidojo, learn vi by actually using it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0c0e";
const RAISED = "#111418";
const EDGE = "#20262d";
const FG = "#d5dbe2";
const DIM = "#7b8794";
const ACCENT = "#5ccfa0";
const KW = "#c98bdb";
const TYPE = "#6fb6e8";
const STR = "#b8d178";
const NUM = "#e0b562";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function Dot({ color }: { color: string }) {
  return (
    <div
      style={{ width: 12, height: 12, borderRadius: 6, background: color }}
    />
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          fontFamily: MONO,
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 56, color: FG, fontWeight: 700 }}>vidojo</div>
          <div
            style={{
              display: "flex",
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${EDGE}`,
              color: ACCENT,
              fontSize: 22,
            }}
          >
            NORMAL
          </div>
        </div>

        <div style={{ display: "flex", color: DIM, fontSize: 28, marginTop: 14 }}>
          Learn vi by actually using it
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            flex: 1,
            borderRadius: 12,
            border: `1px solid ${EDGE}`,
            background: RAISED,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "12px 18px",
              borderBottom: `1px solid ${EDGE}`,
            }}
          >
            <Dot color="#e8736b" />
            <Dot color="#e0b562" />
            <Dot color="#5ccfa0" />
            <div style={{ color: DIM, fontSize: 19, marginLeft: 14 }}>
              sami@vidojo: ~/src
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "20px 24px",
              fontSize: 25,
              lineHeight: 1.55,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: ACCENT }}>~/src $</span>
              <span style={{ color: FG }}>vi render.cpp</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span style={{ color: DIM, width: 40 }}>12</span>
              <span style={{ color: KW }}>for</span>
              <span style={{ color: FG }}>(</span>
              <span style={{ color: TYPE }}>int</span>
              <span style={{ color: FG }}>y =</span>
              <span style={{ color: NUM }}>0</span>
              <span style={{ color: FG }}>; y &lt; h; ++y) {"{"}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: DIM, width: 40 }}>13</span>
              <span style={{ color: TYPE }}>&nbsp;&nbsp;Vec3</span>
              <span style={{ color: FG }}>c = trace(scene, ray);</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: DIM, width: 40 }}>14</span>
              <span style={{ color: FG }}>&nbsp;&nbsp;film.set(x, y,</span>
              <span style={{ color: STR }}>tonemap</span>
              <span style={{ color: FG }}>(c));</span>
              <span
                style={{
                  width: 15,
                  height: 30,
                  background: ACCENT,
                  marginLeft: 2,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, color: EDGE }}>
              <span style={{ color: DIM, width: 40 }}>~</span>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 14, fontSize: 22 }}>
              <span style={{ color: DIM }}>hjkl</span>
              <span style={{ color: DIM }}>ciw</span>
              <span style={{ color: DIM }}>di&quot;</span>
              <span style={{ color: DIM }}>3dw</span>
              <span style={{ color: DIM }}>gg</span>
              <span style={{ color: DIM }}>:wq</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
