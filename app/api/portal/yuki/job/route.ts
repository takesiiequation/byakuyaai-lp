// デスクユキ 進捗API(R2): jobs/{client}/{job}/ev-*.json の新しい断片を返す。完了時は精算(台帳・セッション・会話記録)して done
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { pollJob } from "@/app/_lib/yuki_cp";

export const maxDuration = 30;
// 画面に流してよいイベントだけ(道具の生の入力は出さない=内部構成の露出を避ける)
const PASS = new Set(["text_start", "text", "tool", "tool_result", "deny", "cost", "done", "error", "job", "sync", "init", "result", "image"]);

export async function GET(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const jobId = req.nextUrl.searchParams.get("job_id") || "";
  const cursor = req.nextUrl.searchParams.get("cursor") || "";
  if (cursor && !cursor.startsWith(`jobs/${clientId}/${jobId}/ev-`)) return NextResponse.json({ ok: false, error: "invalid_cursor" }, { status: 400 });
  const r = await pollJob(clientId, jobId, cursor, client.plan);
  if (!r.ok) return NextResponse.json(r, { status: r.error === "not_found" ? 404 : 400 });
  const events = (r.events as Array<Record<string, unknown>>).filter((e) => PASS.has(String(e.type))).map((e) => {
    const t = String(e.type);
    if (t === "tool") return { type: t, name: e.name };                                       // 入力は出さない
    if (t === "tool_result") return { type: t, name: e.name };                                // 生の結果も出さない(本文はユキが書く)
    if (t === "deny") return { type: t, name: e.name, reason: e.reason, proposal: e.proposal ? { tool: (e.proposal as Record<string, unknown>).tool, args_hash: (e.proposal as Record<string, unknown>).args_hash, cost_label: (e.proposal as Record<string, unknown>).cost_label } : undefined };
    if (t === "image") return { type: t, key: /^images\/(in|out)\/[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(String(e.key)) ? String(e.key) : "", alt: String(e.alt ?? "").slice(0, 80) };  // 画像は当社S3のキーだけ(表示は /image 経由)
    if (t === "text" || t === "text_start" || t === "error" || t === "done") return { type: t, ...(t === "text" ? { text: e.text } : {}), ...(t === "error" ? { message: e.message } : {}) };
    return { type: t };
  });
  return NextResponse.json({ ok: true, events, cursor: r.cursor, done: r.done, status: r.status, error: r.error, credits: r.credits });
}
