// ユキクレジットの表示用API(R2): 段階の言葉と10%刻みの割合だけ返す(生の金額・トークン数は返さない=設計§6)
import { NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { readLedger, creditsView } from "@/app/_lib/yuki_cp";

export async function GET() {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, credits: creditsView(await readLedger(clientId, client.plan)) });
  } catch {
    return NextResponse.json({ ok: true, credits: { stage: "たっぷり余裕があります", pct10: 0, exhausted: false }, degraded: true });
  }
}
