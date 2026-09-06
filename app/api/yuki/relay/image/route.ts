// デスクユキ 画像リレー(2026-09-06): コンテナ(ユキ)からだけ叩かれる内部API。認証=ジョブごとの短命トークン(ヘッダ x-yuki-job-token)
//   POST {client_id, job_id, op:"generate"|"edit", prompt, size, quality?, image_refs?} → {ok, request_id, price_usd}
//   POST {client_id, job_id, action:"cancel", request_id} → 依頼の取り消し
//   GET  ?client_id&job_id&request_id → {ok, status:"pending"|"done", key?, cost_usd?, credits?}
//   鍵(FAL_KEY)は制御面(Vercel)だけが持つ。台帳もここが書く。
import { NextRequest, NextResponse } from "next/server";
import { verifyJobToken, submitImage, pollImage, cancelImage, IMAGE_SIZES, type ImageOp, type ImageQuality } from "@/app/_lib/yuki_images";

export const maxDuration = 60;
const tokenOf = (req: NextRequest, b?: Record<string, unknown>) => String(req.headers.get("x-yuki-job-token") || (b?.token as string) || "");

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const clientId = String(b.client_id || ""), jobId = String(b.job_id || "");
  const v = await verifyJobToken(clientId, jobId, tokenOf(req, b));
  if (!v.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (b.action === "cancel") return NextResponse.json({ ok: await cancelImage({ clientId, jobId, requestId: String(b.request_id || "") }) });
  const op: ImageOp = b.op === "edit" ? "edit" : "generate";
  const size = String(b.size || "square");
  if (!Object.hasOwn(IMAGE_SIZES, size)) return NextResponse.json({ ok: false, error: "invalid_size" }, { status: 400 });  // `in` は prototype を通す
  const quality: ImageQuality = b.quality === "high" ? "high" : "medium";
  const refs = Array.isArray(b.image_refs) ? (b.image_refs as unknown[]).map(String) : [];
  const r = await submitImage({ clientId, jobId, plan: v.plan, op, prompt: String(b.prompt || ""), size, quality, refs });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, request_id: r.request_id, price_usd: r.price_usd });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const clientId = q.get("client_id") || "", jobId = q.get("job_id") || "", requestId = q.get("request_id") || "";
  const v = await verifyJobToken(clientId, jobId, tokenOf(req));
  if (!v.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await pollImage({ clientId, jobId, plan: v.plan, requestId });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
