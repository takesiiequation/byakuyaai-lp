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

  // Log every hit for hp/line, including unregistered client_ids — a typo'd
  // link or a client that was never wired into LINKS previously fell back to
  // FALLBACK silently, with no click log and no error, so a broken link could
  // sit unnoticed indefinitely. matched=0 flags a fallback hit so ops can
  // tell it apart from a normal click without a separate webhook/env var.
  if (dest === "hp" || dest === "line") {
    const qs = new URLSearchParams({
      c: client,
      d: dest,
      r: req.headers.get("referer") ?? "",
      matched: entry ? "1" : "0",
    });
    after(
      fetch(`${LOG_URL}?${qs.toString()}`, {
        headers: { "user-agent": req.headers.get("user-agent") ?? "" },
      }).catch(() => {})
    );
  }

  return NextResponse.redirect(target, 302);
}
