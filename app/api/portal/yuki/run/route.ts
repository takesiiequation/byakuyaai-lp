// デスクユキ 起動API(R2): 依頼文を受けてFargateタスクを1つ起こす。返すのは job_id だけ(進捗は /job をポーリング)
//   認証: portal-session(会社スコープ) / ゲート: DESK_RELEASED→portal_enabled→workspace_enabled(毎回シートから)
//   お金: 台帳の残高が「答えるだけの小枠」以下なら、課金道具の承認(paid_grant)付きの依頼は断る(会話は通す)。総枠+5%を超えたら会話も止める(閲覧は可)
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { loadJson, saveJson } from "@/app/_lib/props_store";
import { startJob, readLedger, creditsView, cpConfigured, PAID_TOOL_LABELS } from "@/app/_lib/yuki_cp";
import { readProdLedger, productionView } from "@/app/_lib/yuki_clips";
import { toolName } from "@/app/_lib/yuki_tool_ids";

export const maxDuration = 60;
const RATE_MAX = 8, RATE_WINDOW_MS = 5 * 60_000;
/** テスト顧客が借りている設計図の持ち主(props_lint の自社扱い)。顧客名をコンテナのコードに置かないためここで決める */
const LINT_ALIASES: Record<string, string[]> = { test: ["sugita"] };
async function rateLimited(key: string): Promise<boolean> {
  const k = `ratelimit/deskrun_${key}.json`; const now = Date.now();
  const prev = (await loadJson(k)) as { t?: number[] } | null;
  const arr = (prev?.t ?? []).filter((x) => typeof x === "number" && now - x < RATE_WINDOW_MS); arr.push(now);
  await saveJson(k, { t: arr.slice(-40) });
  return arr.length > RATE_MAX;
}

export async function POST(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!cpConfigured()) return NextResponse.json({ ok: false, error: "ただいま準備中です。担当者までご連絡ください" }, { status: 503 });
  if (await rateLimited(clientId)) return NextResponse.json({ ok: false, error: "少し間を置いてからお試しください" }, { status: 429 });

  let body: { prompt?: unknown; paid_grant?: unknown; thread_id?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 4400) return NextResponse.json({ ok: false, error: "invalid_prompt" }, { status: 400 });  // 4000字+添付行の分
  let grant: { tool: string; args_hash: string } | null = null;
  if (body.paid_grant && typeof body.paid_grant === "object") {
    const g = body.paid_grant as Record<string, unknown>;
    const name = typeof g.tool === "string" ? (Object.hasOwn(PAID_TOOL_LABELS, g.tool) ? g.tool : toolName(g.tool)) : "";  // 画面は不透明IDで返す
    if (!name || !Object.hasOwn(PAID_TOOL_LABELS, name) || typeof g.args_hash !== "string" || !/^[a-f0-9]{16}$/.test(g.args_hash)) {
      return NextResponse.json({ ok: false, error: "invalid_grant" }, { status: 400 });
    }
    grant = { tool: name, args_hash: g.args_hash };
  }
  let led; try { led = await readLedger(clientId, client.plan); } catch { return NextResponse.json({ ok: false, error: "ただいま混み合っています。少し時間をおいてお試しください" }, { status: 503 }); }
  const view = creditsView(led);
  if (view.exhausted && grant) return NextResponse.json({ ok: false, error: "今月のユキクレジットの枠を使い切っているため、この操作は実行できません。来月また一緒に働けます", credits: view }, { status: 402 });
  // 「答えるだけの小枠」は総量で5%まで(監査 2026-09-07: 1ジョブごとに小枠が無限に出ていた)
  if (led.used_usd >= led.cap_usd * 1.05) return NextResponse.json({ ok: false, error: "今月のユキクレジットの枠を使い切りました。来月また一緒に働けます(ご相談の閲覧はできます)", credits: view }, { status: 402 });
  let production = null; try { production = productionView(client.plan, Number(client.used_this_month) || 0, await readProdLedger(clientId)); } catch {}

  const threadId = typeof body.thread_id === "string" && /^[a-z0-9]{6,32}$/i.test(body.thread_id) ? body.thread_id : null;
  const r = await startJob({ clientId, clientName: client.client_name ?? "", plan: client.plan, prompt, paidGrant: grant, threadId, usedVideosThisMonth: Number(client.used_this_month) || 0, production, lintAliases: LINT_ALIASES[String(client.plan || "").toLowerCase()] || [] });
  if (!r.ok) {
    const msg = r.error === "busy" ? "ユキが前のご依頼を進めています。終わってからお送りください" : "ただいま混み合っています。少し時間をおいてお試しください";
    if (r.error !== "busy") console.error("[yuki/run] start failed", clientId, r.error);  // 生のエラー(ARN等)は顧客に返さない(監査 2026-09-06)
    return NextResponse.json({ ok: false, error: msg }, { status: r.error === "busy" ? 409 : 502 });
  }
  return NextResponse.json({ ok: true, job_id: r.job_id, thread_id: r.thread_id, credits: view, production });
}
