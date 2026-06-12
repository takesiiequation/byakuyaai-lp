import { NextRequest, NextResponse, after } from "next/server";
import { LINKS, FALLBACK } from "../../links";

const LOG_URL = "https://aiboost-takeshi.app.n8n.cloud/webhook/link-click";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ client: string; dest: string }> }
) {
  const { client, dest } = await params;
  const entry = LINKS[client];
  const target =
    entry == null
      ? FALLBACK
      : dest === "line" && entry.line
        ? entry.line
        : entry.hp;

  if (entry && (dest === "hp" || dest === "line")) {
    const qs = new URLSearchParams({
      c: client,
      d: dest,
      r: req.headers.get("referer") ?? "",
    });
    after(
      fetch(`${LOG_URL}?${qs.toString()}`, {
        headers: { "user-agent": req.headers.get("user-agent") ?? "" },
      }).catch(() => {})
    );
  }

  return NextResponse.redirect(target, 302);
}
