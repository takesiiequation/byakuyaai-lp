// Served as a route (not app/manifest.ts) because the site root already owns
// the marketing manifest — this one is scoped to /me so an install from the
// tracker opens the tracker, not the LP.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      name: "85点の毎日",
      short_name: "85点",
      description: "食事・トレーニング・体重の記録",
      start_url: "/me",
      scope: "/me",
      display: "standalone",
      orientation: "portrait",
      background_color: "#16181B",
      theme_color: "#1E9E5A",
      // purpose は "any" のみ。リングが端まで伸びる全面デザインなので、
      // maskable の安全域（中央80%の円）に収める前提の絵ではない。
      icons: [
        { src: "/me-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
