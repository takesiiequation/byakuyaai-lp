import { NextRequest, NextResponse, after } from "next/server";
import { LINKS, FALLBACK } from "../../links";
import { getAllClients } from "@/app/_lib/sheets";

// This route calls googleapis (via _lib/sheets.ts), which needs Node builtins
// (net/tls) — pin the runtime explicitly rather than relying on the current
// default, so a future Next.js default change can't silently move this route
// to the edge runtime and break it.
export const runtime = "nodejs";

const LOG_URL = "https://aiboost-takeshi.app.n8n.cloud/webhook/link-click";
const CACHE_TTL_MS = 60_000;

interface SheetLinkEntry {
  hp: string;
  line: string;
}

// Module-scope cache (per warm serverless instance) so a burst of clicks on
// a story/profile link doesn't hit the Sheets API on every single request.
// Tier 1 in the 3-tier resolution below.
let sheetLinksCache: { data: Map<string, SheetLinkEntry>; ts: number } | null =
  null;

async function getSheetLinks(): Promise<Map<string, SheetLinkEntry>> {
  const now = Date.now();
  if (sheetLinksCache && now - sheetLinksCache.ts < CACHE_TTL_MS) {
    return sheetLinksCache.data;
  }
  try {
    const clients = await getAllClients();
    const map = new Map<string, SheetLinkEntry>();
    for (const c of clients) {
      if (c.link_hp_url || c.link_line_url) {
        map.set(c.client_id, { hp: c.link_hp_url, line: c.link_line_url });
      }
    }
    sheetLinksCache = { data: map, ts: now };
    return map;
  } catch {
    // Sheet unreachable/misconfigured: fail-soft to whatever's cached
    // (better stale than down), or an empty map so callers fall through to
    // the LINKS/FALLBACK tiers below. A public redirect link must never 500
    // just because a Sheets credential rotated.
    return sheetLinksCache?.data ?? new Map();
  }
}

/**
 * 3-tier resolution: 契約社シート(link_hp_url/link_line_url) → LINKS map →
 * FALLBACK. dest="line" with no line URL in either tier falls through to the
 * hp chain (unchanged long-standing behavior — a client with no LINE page
 * yet still gets a working link). `matched` is true whenever a concrete,
 * non-generic URL was found (used for click-log signal, see below).
 */
async function resolveTarget(
  client: string,
  dest: string
): Promise<{ target: string; matched: boolean }> {
  const sheetEntry = (await getSheetLinks()).get(client);
  const linksEntry = LINKS[client];

  const pick = (field: "hp" | "line"): string => {
    const sheetVal = field === "hp" ? sheetEntry?.hp : sheetEntry?.line;
    if (sheetVal) return sheetVal;
    const linksVal = field === "hp" ? linksEntry?.hp : linksEntry?.line;
    return linksVal || "";
  };

  let target = dest === "line" ? pick("line") : pick("hp");
  if (!target && dest === "line") target = pick("hp"); // dest=lineでLINE未設定はhpへ(現仕様維持)
  if (!target) target = FALLBACK;

  return { target, matched: target !== FALLBACK };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ client: string; dest: string }> }
) {
  const { client, dest } = await params;
  const { target, matched } = await resolveTarget(client, dest);

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
      matched: matched ? "1" : "0",
    });
    after(
      fetch(`${LOG_URL}?${qs.toString()}`, {
        headers: { "user-agent": req.headers.get("user-agent") ?? "" },
      }).catch(() => {})
    );
  }

  return NextResponse.redirect(target, 302);
}
