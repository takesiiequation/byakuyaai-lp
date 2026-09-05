// ユキのデスク ノート閲覧API(R2.5・読み取り専用): 一覧(GET)・1枚(GET ?path=)。編集はチャット経由でユキが行う(設計書§8-6)
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { listNotes, readNote } from "@/app/_lib/yuki_cp";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const p = req.nextUrl.searchParams.get("path");
  try {
    if (p) { const body = await readNote(clientId, p); return body === null ? NextResponse.json({ ok: false, error: "not_found" }, { status: 404 }) : NextResponse.json({ ok: true, path: p, body }); }
    return NextResponse.json({ ok: true, notes: await listNotes(clientId) });
  } catch { return NextResponse.json({ ok: true, notes: [], degraded: true }); }
}
