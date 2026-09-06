// ユキクレジットの表示用API(R2): 段階の言葉と10%刻みの割合だけ返す(生の金額・トークン数は返さない=設計§6)
import { NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { readLedger, creditsView } from "@/app/_lib/yuki_cp";
import { readProdLedger, productionView } from "@/app/_lib/yuki_clips";

export async function GET() {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  // 制作クレジット(数字で見せてよい財布)= 月枠 − 新規制作(本数×10) − 作り直し(台帳)
  let production: ReturnType<typeof productionView> | undefined;
  try { production = productionView(client.plan, Number(client.used_this_month) || 0, await readProdLedger(clientId)); } catch {}
  const build = String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);  // どのデプロイが応答しているか(検証用・秘密ではない)
  try {
    return NextResponse.json({ ok: true, credits: creditsView(await readLedger(clientId, client.plan)), production, build });
  } catch {
    return NextResponse.json({ ok: true, credits: { stage: "たっぷり余裕があります", pct10: 0, exhausted: false }, production, build, degraded: true });
  }
}
