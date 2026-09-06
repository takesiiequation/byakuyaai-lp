// デスクユキの「映像の作り直し枠」(2026-09-06): 制御面リレー方式(画像づくりと同じ骨格)
//   コンテナ(ユキ)はジョブの短命トークンで /api/yuki/relay/clip を叩き、制御面(FAL_KEY)が fal の Seedance(image-to-video)を呼ぶ。
//   お金=**制作クレジット**(お金が外に出る操作・数字で見せる財布)。1カット作り直し=1クレジット。台帳は制御面だけが書く。
//   出来た映像は fal のURL(7日で消える)を返し、コンテナ(タスクロール)が当社S3 clips/{client}/desk/regen/ に複製して設計図に差す。
import { timingSafeEqual } from "crypto";
import { getJsonS3, putJsonS3, type JobMeta } from "./yuki_cp";

const CLIENT_RE = /^(?!\.+$)[a-z0-9][a-z0-9_.-]{0,39}$/i;
const JOB_RE = /^[a-z0-9-]{8,64}$/i;
const APR_RE = /^APR-[a-z0-9]{6,}(-[a-f0-9]{6,})?$/i;
const FAL_BASE = "https://queue.fal.run";
const MODEL = "bytedance/seedance-2.0/image-to-video";
const USD_PER_SEC = 0.3024;  // fal 標準料金(内部の実費記録用・顧客には出さない)

/** 制作クレジット: プランごとの月枠(設計書 yuki_workspace_design §4)。新規制作1本=10・作り直し1カット=1 */
export const PRODUCTION_CAP: Record<string, number> = { premium: 240, test: 240, standard: 120 };
export const CREDITS_PER_VIDEO = 10, CREDITS_PER_REGEN = 1;
export const productionCap = (plan?: string) => PRODUCTION_CAP[String(plan || "").toLowerCase()] ?? PRODUCTION_CAP.standard;

// ---------- 制作クレジット台帳(作り直し分だけ。新規制作分は契約社シートの used_this_month×10 を足して表示) ----------
export type ProdLedger = { regen_used: number; events: Array<{ id: string; at: string; approval_id: string; scene: string; credits: number; usd: number }> };
const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
// 制御面のIAMは credits/* しか読めない(credits_production/ は AccessDenied で production 表示が消える=2026-09-06 本番で判明)。credits/ の下に置く
const prodKey = (c: string) => `credits/${c}/production-${monthKey()}.json`;
export async function readProdLedger(clientId: string): Promise<ProdLedger> {
  return (await getJsonS3<ProdLedger>(prodKey(clientId))).value ?? { regen_used: 0, events: [] };
}
/** 冪等(同じ id は二度足さない)。競合は読み直して最大5回 */
export async function settleProd(clientId: string, ev: { id: string; approval_id: string; scene: string; credits: number; usd: number }): Promise<ProdLedger> {
  for (let i = 0; i < 5; i++) {
    const { value, etag } = await getJsonS3<ProdLedger>(prodKey(clientId));
    const led: ProdLedger = value ?? { regen_used: 0, events: [] };
    if (led.events.some((e) => e.id === ev.id)) return led;
    const next: ProdLedger = { regen_used: led.regen_used + ev.credits, events: [...led.events.slice(-300), { ...ev, at: new Date().toISOString() }] };
    if ((await putJsonS3If(prodKey(clientId), next, etag)) === "ok") return next;
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
  }
  throw new Error("prod_ledger_conflict");
}
// yuki_cp の条件付きPUTを使う(同じS3クライアント)
import { putJsonS3If } from "./yuki_cp";

/** 表示用: cap − 新規制作(used_this_month×10) − 作り直し。数字で見せてよい財布 */
export function productionView(plan: string | undefined, usedVideosThisMonth: number, led: ProdLedger) {
  const cap = productionCap(plan);
  const used = Math.max(0, usedVideosThisMonth) * CREDITS_PER_VIDEO + led.regen_used;
  const remaining = Math.max(0, cap - used);
  return { cap, used, remaining, videos_left: Math.floor(remaining / CREDITS_PER_VIDEO), regen_used: led.regen_used };
}

// ---------- ジョブトークン(画像リレーと同じ) ----------
type JobDoc = { tool_token?: string; plan?: string; used_this_month?: number };
export async function verifyClipToken(clientId: string, jobId: string, token: string): Promise<{ ok: true; plan?: string; usedVideos: number } | { ok: false; error: string }> {
  if (!CLIENT_RE.test(clientId) || !JOB_RE.test(jobId) || !/^[a-f0-9]{32,64}$/i.test(token)) return { ok: false, error: "invalid" };
  const job = (await getJsonS3<JobDoc>(`jobs/${clientId}/${jobId}/job.json`)).value;
  if (!job?.tool_token) return { ok: false, error: "no_token" };
  const a = Buffer.from(String(job.tool_token)), b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "bad_token" };
  const meta = (await getJsonS3<JobMeta>(`jobs/${clientId}/${jobId}/meta.json`)).value;
  if (!meta || meta.settled || meta.status !== "running") return { ok: false, error: "job_not_running" };
  if (Date.now() - new Date(meta.started_at).getTime() > 30 * 60_000) return { ok: false, error: "token_expired" };
  return { ok: true, plan: job.plan, usedVideos: Number(job.used_this_month) || 0 };
}

/** 複製完了の申告→ここで初めて制作クレジット1を精算(冪等)。監査 2026-09-07: 複製失敗でもクレジットだけ減っていた */
export async function commitClip(p: { clientId: string; jobId: string; plan?: string; usedVideos: number; requestId: string }): Promise<{ ok: true; credits: ReturnType<typeof productionView> } | { ok: false; error: string; status: number }> {
  if (!/^[a-z0-9-]{8,80}$/i.test(p.requestId)) return { ok: false, error: "invalid_request_id", status: 400 };
  const k = clipKey(p.clientId, p.jobId, p.requestId);
  const rec = (await getJsonS3<ClipRecord>(k)).value;
  if (!rec || rec.status !== "done" || !rec.video_url) return { ok: false, error: "not_done", status: 409 };
  const led = await settleProd(p.clientId, { id: p.requestId, approval_id: rec.approval_id, scene: rec.scene, credits: CREDITS_PER_REGEN, usd: rec.usd || 0 });
  await putJsonS3(k, { ...rec, settled: true });
  return { ok: true, credits: productionView(p.plan, p.usedVideos, led) };
}

/** 依頼の取り消し(コンテナ側のタイムアウト時) */
export async function cancelClip(p: { clientId: string; jobId: string; requestId: string }): Promise<boolean> {
  if (!/^[a-z0-9-]{8,80}$/i.test(p.requestId)) return false;
  const k = clipKey(p.clientId, p.jobId, p.requestId);
  const rec = (await getJsonS3<ClipRecord>(k)).value;
  if (!rec || rec.status !== "pending" || !rec.cancel_url) return false;
  try { const r = await falFetch(rec.cancel_url, { method: "PUT" }); await putJsonS3(k, { ...rec, status: "failed", error: "cancelled" }); return r.status < 300; } catch { return false; }
}

// ---------- fal ----------
function falKey(): string { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
async function falFetch(url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Key ${falKey()}`, "Content-Type": "application/json" } });
  let json: Record<string, unknown> = {}; try { json = (await r.json()) as Record<string, unknown>; } catch {}
  return { status: r.status, json };
}
type ClipRecord = { approval_id: string; scene: string; prompt: string; image_url: string; duration: number; resolution: string; aspect_ratio: string; at: string; status_url: string; response_url: string; cancel_url?: string; status: "pending" | "done" | "failed"; video_url?: string; error?: string; usd?: number; dry_run?: boolean; settled?: boolean };
const clipKey = (c: string, j: string, rid: string) => `jobs/${c}/${j}/clip/${rid}.json`;
const ASPECTS = new Set(["9:16", "16:9", "1:1", "4:3", "3:4", "21:9", "auto"]);

/** 依頼: 残高(制作クレジット≥1)→fal待ち行列へ→記録。dry_run は fal を呼ばず既存の公開クリップを返す(配管の検証用・課金ゼロ) */
export async function submitClip(p: { clientId: string; jobId: string; plan?: string; usedVideos: number; approval_id: string; scene: string; image_url: string; prompt: string; duration?: number; resolution?: string; aspect_ratio?: string; dry_run?: boolean }): Promise<{ ok: true; request_id: string; credits: number } | { ok: false; error: string; status: number }> {
  if (!APR_RE.test(p.approval_id) || !/^[a-z0-9_-]{1,32}$/i.test(p.scene)) return { ok: false, error: "invalid_scene", status: 400 };
  // 元写真は当社のS3にある物だけ(監査 2026-09-07: 任意のhttps画像=他社や他所の物件写真から映像を作れてしまう)
  if (!/^https:\/\/byakuyaai-media\.s3(\.ap-northeast-1)?\.amazonaws\.com\/[^\s"']+\.(jpe?g|png|webp)(\?.*)?$/i.test(p.image_url)) return { ok: false, error: "元写真が当社の保管場所にありません(作り直しは当社でお預かりした写真からだけ行えます)", status: 400 };
  if (p.dry_run && process.env.NODE_ENV === "production") return { ok: false, error: "dry_run は本番では使えません", status: 400 };
  const prompt = String(p.prompt || "").trim().slice(0, 1500);
  if (prompt.length < 4) return { ok: false, error: "invalid_prompt", status: 400 };
  const duration = Math.min(8, Math.max(4, Math.round(Number(p.duration) || 4)));
  const resolution = p.resolution === "720p" ? "720p" : "1080p";
  const aspect_ratio = p.aspect_ratio && ASPECTS.has(p.aspect_ratio) ? p.aspect_ratio : "9:16";
  const led = await readProdLedger(p.clientId);
  const view = productionView(p.plan, p.usedVideos, led);
  if (view.remaining < CREDITS_PER_REGEN) return { ok: false, error: "今月の制作クレジットが足りないため、作り直しはできません", status: 402 };
  const at = new Date().toISOString();
  if (p.dry_run && process.env.NODE_ENV !== "production") {
    const rid = "dry-" + Date.now().toString(36);
    await putJsonS3(clipKey(p.clientId, p.jobId, rid), { approval_id: p.approval_id, scene: p.scene, prompt, image_url: p.image_url, duration, resolution, aspect_ratio, at, status_url: "", response_url: "", status: "pending", dry_run: true } as ClipRecord);
    return { ok: true, request_id: rid, credits: CREDITS_PER_REGEN };
  }
  if (!falKey()) return { ok: false, error: "作り直しはただいま準備中です(担当者へお繋ぎください)", status: 503 };
  const body = { prompt, image_url: p.image_url, duration: String(duration), aspect_ratio, resolution, generate_audio: false };
  const r = await falFetch(`${FAL_BASE}/${MODEL}`, { method: "POST", body: JSON.stringify(body) });
  const rid = String(r.json.request_id || "");
  if (r.status >= 300 || !rid) return { ok: false, error: r.status === 422 ? "この内容では映像を作れませんでした(内容の制限に触れた可能性があります)" : `作り直しの依頼に失敗しました(${r.status})`, status: 502 };
  await putJsonS3(clipKey(p.clientId, p.jobId, rid), { approval_id: p.approval_id, scene: p.scene, prompt, image_url: p.image_url, duration, resolution, aspect_ratio, at, status_url: String(r.json.status_url || ""), response_url: String(r.json.response_url || ""), cancel_url: String(r.json.cancel_url || ""), status: "pending" } as ClipRecord);
  return { ok: true, request_id: rid, credits: CREDITS_PER_REGEN };
}

/** 進捗: 完成なら fal の動画URLを返す。精算は複製後の commitClip で(複製はコンテナが行う) */
export async function pollClip(p: { clientId: string; jobId: string; plan?: string; usedVideos: number; requestId: string }): Promise<{ ok: true; status: "pending" | "done"; video_url?: string; duration?: number; credits?: ReturnType<typeof productionView>; usd?: number } | { ok: false; error: string; status: number }> {
  if (!/^[a-z0-9-]{8,80}$/i.test(p.requestId)) return { ok: false, error: "invalid_request_id", status: 400 };
  const k = clipKey(p.clientId, p.jobId, p.requestId);
  const rec = (await getJsonS3<ClipRecord>(k)).value;
  if (!rec) return { ok: false, error: "not_found", status: 404 };
  const done = async (video_url: string, usd: number) => {
    await putJsonS3(k, { ...rec, status: "done", video_url, usd });
    return { ok: true as const, status: "done" as const, video_url, duration: rec.duration, usd, credits: productionView(p.plan, p.usedVideos, await readProdLedger(p.clientId)) };
  };
  if (rec.status === "done" && rec.video_url) return { ok: true, status: "done", video_url: rec.video_url, duration: rec.duration, usd: rec.usd, credits: productionView(p.plan, p.usedVideos, await readProdLedger(p.clientId)) };
  if (rec.status === "failed") return { ok: false, error: rec.error || "failed", status: 502 };
  if (rec.dry_run) {
    // 配管の検証: 実在する公開クリップ(テスト顧客のもの)を「出来た映像」として返す。台帳には0ドルで1クレジット
    if (Date.now() - new Date(rec.at).getTime() < 4000) return { ok: true, status: "pending" };
    return done(process.env.YUKI_DRY_RUN_CLIP_URL || "https://byakuyaai-media.s3.ap-northeast-1.amazonaws.com/clips/sugita/APR-mtfjm2jx/s08.mp4", 0);
  }
  const st = await falFetch(rec.status_url);
  const status = String(st.json.status || "");
  if (status === "IN_QUEUE" || status === "IN_PROGRESS") return { ok: true, status: "pending" };
  if (status !== "COMPLETED") {
    const err = status ? `作り直しが失敗しました(${status})` : `進捗を確認できませんでした(${st.status})`;
    if (st.status === 200 || st.status === 422 || st.status === 400) { await putJsonS3(k, { ...rec, status: "failed", error: err }); return { ok: false, error: err, status: 502 }; }
    return { ok: true, status: "pending" };
  }
  const res = await falFetch(rec.response_url);
  const url = String(((res.json.video as Record<string, unknown>) || {}).url || "");
  if (!url) { const err = "映像が返ってきませんでした"; await putJsonS3(k, { ...rec, status: "failed", error: err }); return { ok: false, error: err, status: 502 }; }
  return done(url, +(USD_PER_SEC * rec.duration).toFixed(4));
}
