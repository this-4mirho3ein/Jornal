// Note: unlike most cacheComponents routes this stays dynamic on purpose —
// ImageResponse (a Response instance) cannot cross a "use cache" serialization
// boundary, and the generated PNG is CDN-cacheable at request time anyway.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Trading Journal — realtime MetaTrader 5 trade journaling: strategies, R-multiples, screenshots";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Brand OG card (§14) — static at build; logo embedded so no request-time fetch. */
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo.png"));
  const logoSrc = `data:image/png;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(34,197,94,0.16), transparent 45%), radial-gradient(circle at 10% 90%, rgba(245,158,11,0.10), transparent 40%)",
          padding: 72,
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={logoSrc}
            width={132}
            height={88}
            alt=""
            style={{ borderRadius: 16 }}
          />
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: -1,
              color: "#e4e4e7",
            }}
          >
            Trading Journal
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.05,
              maxWidth: 950,
            }}
          >
            Your MT5 trades, journaled automatically
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#a1a1aa" }}>
            Realtime sync · Strategy tagging · R-multiples · Screenshots
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 10,
              borderRadius: 999,
              backgroundColor: "#22c55e",
            }}
          />
          <div style={{ display: "flex", fontSize: 28, color: "#71717a" }}>
            Private · Single-owner · PWA installable
          </div>
        </div>
      </div>
    ),
    size,
  );
}
