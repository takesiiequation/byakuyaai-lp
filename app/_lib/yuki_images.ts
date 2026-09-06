// デスクユキの画像づくり(2026-09-06): 制御面リレー方式
//   コンテナ(ユキ)は鍵を持たない。ジョブごとの短命トークン(job.json の tool_token)で制御面を叩き、制御面が fal(openai/gpt-image-2)を呼ぶ。
//   台帳(ユキクレジット)は制御面だけが書く: 依頼前に残高を見て、完成した1枚ごとに定価を精算(request_id で冪等)。
//   画像はすべて S3 の workspace/{client}/images/{in|out}/ に置く(非公開)。画面には /api/portal/yuki/image?key= 経由(署名付きURLへ転送)で出す。
//   モデル: 生成=openai/gpt-image-2(文章→画像) / 加工=openai/gpt-image-2/edit(参考画像+文章→画像。参考=雰囲気・構図・写真そのものの加工)
import { HeadObjectCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { timingSafeEqual, randomBytes } from "crypto";
import { s3Client, YUKI_BUCKET, getJsonS3, putJsonS3, readLedger, settleLedger, creditsView, RESERVE_USD, type JobMeta } from "./yuki_cp";

const CLIENT_RE = /^(?!\.+$)[a-z0-9][a-z0-9_.-]{0,39}$/i;
const JOB_RE = /^[a-z0-9-]{8,64}$/i;
export const IMAGE_KEY_RE = /^images\/(in|out)\/[a-z0-9_-]{4,64}\.(png|jpe?g|webp)$/i;
const FAL_BASE = "https://queue.fal.run";
const MODEL_GEN = "openai/gpt-image-2", MODEL_EDIT = "openai/gpt-image-2/edit";

/** 向き→実寸(16の倍数・falの料金表に合わせる)と定価(USD/枚)。tall(9:16)は表に無いので 1920×1080 の段に1割乗せる */
export const IMAGE_SIZES: Record<string, { width: number; height: number; label: string; price: { medium: number; high: number } }> = {
  square:    { width: 1024, height: 1024, label: "正方形(1:1)",   price: { medium: 0.053, high: 0.211 } },
  portrait:  { width: 1024, height: 1536, label: "縦長(2:3)",     price: { medium: 0.042, high: 0.165 } },
  landscape: { width: 1920, height: 1080, label: "横長(16:9)",    price: { medium: 0.040, high: 0.158 } },
  tall:      { width: 1088, height: 1920, label: "縦長(9:16・ストーリー/リール)", price: { medium: 0.044, high: 0.174 } },
  auto:      { width: 0,    height: 0,    label: "元の画像に合わせる(加工のみ)", price: { medium: 0.053, high: 0.211 } },  // 出力寸法はモデル任せ=料金は最も高い段で見積もる
};
export type ImageQuality = "medium" | "high";
export type ImageOp = "generate" | "edit";
export const MAX_REFS = 4;

type JobDoc = { tool_token?: string; plan?: string; client_name?: string };
type ImgRecord = { op: ImageOp; size: string; quality: ImageQuality; price_usd: number; at: string; prompt: string; status_url: string; response_url: string; cancel_url?: string; status: "pending" | "done" | "failed"; key?: string; width?: number; height?: number; error?: string; settled?: boolean };

const imgKey = (c: string, j: string, rid: string) => `jobs/${c}/${j}/img/${rid}.json`;

/** ジョブトークンの照合: job.json の tool_token と一致し、meta が running(未精算)のジョブだけ通す */
export async function verifyJobToken(clientId: string, jobId: string, token: string): Promise<{ ok: true; plan?: string } | { ok: false; error: string }> {
  if (!CLIENT_RE.test(clientId) || !JOB_RE.test(jobId) || !/^[a-f0-9]{32,64}$/i.test(token)) return { ok: false, error: "invalid" };
  const job = (await getJsonS3<JobDoc>(`jobs/${clientId}/${jobId}/job.json`)).value;
  if (!job?.tool_token) return { ok: false, error: "no_token" };
  const a = Buffer.from(String(job.tool_token)), b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "bad_token" };
  const meta = (await getJsonS3<JobMeta>(`jobs/${clientId}/${jobId}/meta.json`)).value;
  if (!meta || meta.settled || meta.status !== "running") return { ok: false, error: "job_not_running" };
  if (Date.now() - new Date(meta.started_at).getTime() > 30 * 60_000) return { ok: false, error: "token_expired" };  // 仕事の上限より長くは生きない(監査 2026-09-07)
  return { ok: true, plan: job.plan };
}

/** 依頼の取り消し(コンテナ側のタイムアウト時。fal に走り続けさせない) */
export async function cancelImage(p: { clientId: string; jobId: string; requestId: string }): Promise<boolean> {
  if (!/^[a-z0-9-]{8,80}$/i.test(p.requestId)) return false;
  const rec = (await getJsonS3<ImgRecord>(imgKey(p.clientId, p.jobId, p.requestId))).value;
  if (!rec || rec.status !== "pending" || !rec.cancel_url) return false;
  try { const r = await falFetch(rec.cancel_url, { method: "PUT" }); await putJsonS3(imgKey(p.clientId, p.jobId, p.requestId), { ...rec, status: "failed", error: "cancelled" }); return r.status < 300; } catch { return false; }
}

export async function presignImage(clientId: string, key: string, seconds = 600): Promise<string | null> {
  if (!CLIENT_RE.test(clientId) || !IMAGE_KEY_RE.test(key)) return null;
  const Key = `workspace/${clientId}/${key}`;
  try { await s3Client().send(new HeadObjectCommand({ Bucket: YUKI_BUCKET, Key })); } catch { return null; }
  return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: YUKI_BUCKET, Key }), { expiresIn: seconds });
}

/** お預かり画像(お客様のアップロード)を workspace/{client}/images/in/ に置く。中身の先頭バイトで種類を判定 */
export async function storeUpload(clientId: string, body: Buffer): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  if (!CLIENT_RE.test(clientId)) return { ok: false, error: "invalid_client" };
  if (body.length < 64 || body.length > 6 * 1024 * 1024) return { ok: false, error: "size" };
  let ext = "", ct = "";
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) { ext = "jpg"; ct = "image/jpeg"; }
  else if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { ext = "png"; ct = "image/png"; }
  else if (body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP") { ext = "webp"; ct = "image/webp"; }
  else return { ok: false, error: "type" };
  const key = `images/in/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
  await s3Client().send(new PutObjectCommand({ Bucket: YUKI_BUCKET, Key: `workspace/${clientId}/${key}`, Body: body, ContentType: ct }));
  return { ok: true, key };
}

export async function listImages(clientId: string): Promise<Array<{ key: string; size: number; updated_at: string }>> {
  if (!CLIENT_RE.test(clientId)) return [];
  const prefix = `workspace/${clientId}/images/`;
  const r = await s3Client().send(new ListObjectsV2Command({ Bucket: YUKI_BUCKET, Prefix: prefix, MaxKeys: 400 }));
  return (r.Contents ?? []).map((o) => ({ key: o.Key!.slice(`workspace/${clientId}/`.length), size: o.Size ?? 0, updated_at: o.LastModified?.toISOString() ?? "" })).filter((x) => IMAGE_KEY_RE.test(x.key)).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

function falKey(): string { return process.env.FAL_KEY || process.env.FAL_API_KEY || ""; }
export const imagesConfigured = () => !!falKey();

async function falFetch(url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Key ${falKey()}`, "Content-Type": "application/json" } });
  let json: Record<string, unknown> = {};
  try { json = (await r.json()) as Record<string, unknown>; } catch {}
  return { status: r.status, json };
}

/** 依頼: 残高確認→参考画像の署名URL→falの待ち行列へ投入→記録。返すのは request_id だけ(完了は pollImage で) */
export async function submitImage(p: { clientId: string; jobId: string; plan?: string; op: ImageOp; prompt: string; size: string; quality: ImageQuality; refs: string[] }): Promise<{ ok: true; request_id: string; price_usd: number } | { ok: false; error: string; status: number }> {
  if (!imagesConfigured()) return { ok: false, error: "画像づくりはただいま準備中です(担当者へお繋ぎください)", status: 503 };
  const sz = IMAGE_SIZES[p.size === "auto" && p.op !== "edit" ? "square" : p.size];
  if (!sz) return { ok: false, error: "invalid_size", status: 400 };
  const quality: ImageQuality = p.quality === "high" ? "high" : "medium";
  const prompt = String(p.prompt || "").trim().slice(0, 4000);
  if (prompt.length < 2) return { ok: false, error: "invalid_prompt", status: 400 };
  const price = sz.price[quality];
  const led = await readLedger(p.clientId, p.plan);
  if (led.cap_usd - led.used_usd - price < RESERVE_USD) return { ok: false, error: "今月のユキクレジットの枠が足りないため、この画像は作れません", status: 402 };
  const image_urls: string[] = [];
  if (p.op === "edit") {
    const refs = Array.from(new Set(p.refs.filter((k) => IMAGE_KEY_RE.test(k)))).slice(0, MAX_REFS);
    if (!refs.length) return { ok: false, error: "参考画像(image_refs)が必要です。images/in/… か images/out/… のキーを指定してください", status: 400 };
    for (const k of refs) { const u = await presignImage(p.clientId, k, 1800); if (!u) return { ok: false, error: `参考画像が見つかりません: ${k}`, status: 400 }; image_urls.push(u); }
  }
  const body: Record<string, unknown> = { prompt, image_size: sz.width ? { width: sz.width, height: sz.height } : "auto", quality, num_images: 1, output_format: "png", background: "auto", ...(p.op === "edit" ? { image_urls } : {}) };
  const r = await falFetch(`${FAL_BASE}/${p.op === "edit" ? MODEL_EDIT : MODEL_GEN}`, { method: "POST", body: JSON.stringify(body) });
  const rid = String(r.json.request_id || "");
  if (r.status >= 300 || !rid) {
    const detail = JSON.stringify(r.json).slice(0, 300);
    return { ok: false, error: r.status === 422 ? "この内容は生成できませんでした(内容の制限に触れた可能性があります)" : `画像の依頼に失敗しました(${r.status})`, status: 502, ...(process.env.NODE_ENV !== "production" ? { detail } : {}) } as { ok: false; error: string; status: number };
  }
  const rec: ImgRecord = { op: p.op, size: p.size, quality, price_usd: price, at: new Date().toISOString(), prompt: prompt.slice(0, 500), status_url: String(r.json.status_url || ""), response_url: String(r.json.response_url || ""), cancel_url: String(r.json.cancel_url || ""), status: "pending" };
  await putJsonS3(imgKey(p.clientId, p.jobId, rid), rec);
  return { ok: true, request_id: rid, price_usd: price };
}

/** 進捗: 完成していれば画像を当社S3へ取り込み、定価を台帳に精算(冪等)して key を返す */
export async function pollImage(p: { clientId: string; jobId: string; plan?: string; requestId: string }): Promise<{ ok: true; status: "pending" | "done"; key?: string; width?: number; height?: number; cost_usd?: number; credits?: ReturnType<typeof creditsView> } | { ok: false; error: string; status: number }> {
  if (!/^[a-z0-9-]{8,80}$/i.test(p.requestId)) return { ok: false, error: "invalid_request_id", status: 400 };
  const k = imgKey(p.clientId, p.jobId, p.requestId);
  const rec = (await getJsonS3<ImgRecord>(k)).value;
  if (!rec) return { ok: false, error: "not_found", status: 404 };
  if (rec.status === "done" && rec.key) return { ok: true, status: "done", key: rec.key, width: rec.width, height: rec.height, cost_usd: rec.price_usd, credits: creditsView(await readLedger(p.clientId, p.plan)) };
  if (rec.status === "failed") return { ok: false, error: rec.error || "failed", status: 502 };
  const st = await falFetch(rec.status_url);
  const status = String(st.json.status || "");
  if (status === "IN_QUEUE" || status === "IN_PROGRESS") return { ok: true, status: "pending" };
  if (status !== "COMPLETED") {
    const err = status ? `画像づくりが失敗しました(${status})` : `進捗を確認できませんでした(${st.status})`;
    if (st.status === 200 || st.status === 422 || st.status === 400) { await putJsonS3(k, { ...rec, status: "failed", error: err }); return { ok: false, error: err, status: 502 }; }
    return { ok: true, status: "pending" };  // 一時的な不調は次回に持ち越す
  }
  const res = await falFetch(rec.response_url);
  const img = (((res.json.images as Array<Record<string, unknown>>) || [])[0]) as Record<string, unknown> | undefined;
  const url = String(img?.url || "");
  if (!url) { const err = "画像が返ってきませんでした"; await putJsonS3(k, { ...rec, status: "failed", error: err }); return { ok: false, error: err, status: 502 }; }
  const bin = await fetch(url);
  if (!bin.ok) return { ok: true, status: "pending" };
  const buf = Buffer.from(await bin.arrayBuffer());
  // 中身の先頭バイトで種類を決める(Content-Type を信じない=監査 2026-09-07)。画像でなければ失敗にして精算しない
  let ext = "", ct = "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { ext = "jpg"; ct = "image/jpeg"; }
  else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { ext = "png"; ct = "image/png"; }
  else if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") { ext = "webp"; ct = "image/webp"; }
  if (!ext) { const err = "画像として読めない結果でした"; await putJsonS3(k, { ...rec, status: "failed", error: err }); return { ok: false, error: err, status: 502 }; }
  const key = `images/out/${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.${ext}`;
  await s3Client().send(new PutObjectCommand({ Bucket: YUKI_BUCKET, Key: `workspace/${p.clientId}/${key}`, Body: buf, ContentType: ct, Metadata: { op: rec.op, request: p.requestId } }));
  const led = await settleLedger(p.clientId, p.plan, { job_id: `img-${p.requestId}`, cost_usd: rec.price_usd, tools_cost_usd: 0 });
  await putJsonS3(k, { ...rec, status: "done", key, width: Number(img?.width) || undefined, height: Number(img?.height) || undefined, settled: true });
  return { ok: true, status: "done", key, width: Number(img?.width) || undefined, height: Number(img?.height) || undefined, cost_usd: rec.price_usd, credits: creditsView(led) };
}
