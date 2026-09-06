// デスクユキ 映像の作り直しリレー(2026-09-06): コンテナからだけ叩かれる内部API(認証=ジョブの短命トークン。ヘッダ x-yuki-job-token)
//   POST {client_id, job_id, approval_id, scene, image_url, prompt, duration?, resolution?, aspect_ratio?, dry_run?} → {ok, request_id, credits}
//   POST {client_id, job_id, action:"commit", request_id} → 複製完了の申告→制作クレジット1を精算 / action:"cancel" → 依頼の取り消し
//   GET  ?client_id&job_id&request_id → {ok, status:"pending"|"done", video_url?}
//   鍵(FAL_KEY)は制御面(Vercel)だけが持つ。台帳もここが書く。
import { NextRequest, NextResponse } from "next/server";
import { verifyClipToken, submitClip, pollClip, commitClip, cancelClip } from "@/app/_lib/yuki_clips";

export const maxDuration = 60;
const tokenOf = (req: NextRequest, b?: Record<string, unknown>) => String(req.headers.get("x-yuki-job-token") || (b?.token as string) || "");  // 旧: 本文の token も受ける(移行期間)

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const clientId = String(b.client_id || ""), jobId = String(b.job_id || "");
  const v = await verifyClipToken(clientId, jobId, tokenOf(req, b));
  if (!v.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (b.action === "commit") {
    const r = await commitClip({ clientId, jobId, plan: v.plan, usedVideos: v.usedVideos, requestId: String(b.request_id || "") });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json(r);
  }
  if (b.action === "cancel") return NextResponse.json({ ok: await cancelClip({ clientId, jobId, requestId: String(b.request_id || "") }) });
  const r = await submitClip({ clientId, jobId, plan: v.plan, usedVideos: v.usedVideos, approval_id: String(b.approval_id || ""), scene: String(b.scene || ""), image_url: String(b.image_url || ""), prompt: String(b.prompt || ""), duration: Number(b.duration) || undefined, resolution: typeof b.resolution === "string" ? b.resolution : undefined, aspect_ratio: typeof b.aspect_ratio === "string" ? b.aspect_ratio : undefined, dry_run: b.dry_run === true });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, request_id: r.request_id, credits: r.credits });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const clientId = q.get("client_id") || "", jobId = q.get("job_id") || "", requestId = q.get("request_id") || "";
  const v = await verifyClipToken(clientId, jobId, tokenOf(req));  // GET はヘッダのみ(クエリのトークンはログに残る)
  if (!v.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await pollClip({ clientId, jobId, plan: v.plan, usedVideos: v.usedVideos, requestId });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
