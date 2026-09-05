// デスクユキの制御面(2026-09-05 R2)
//   役目: ①ユキクレジット台帳(唯一の書き手) ②Fargateタスクの起動(ジョブ仕様をS3に置いて署名付きURLを渡す)
//        ③イベント断片(jobs/{client}/{job}/ev-*.json)のポーリング ④完了時の精算(台帳・セッション・会話記録)
//   鍵: ECS_AWS_ACCESS_KEY_ID / ECS_AWS_SECRET_ACCESS_KEY(= IAMユーザー byakuyaai-control-plane。RunTask/PassRole/jobs・build・credits)。
//        無ければ AWS_ACCESS_KEY_ID(S3用)に落ちるが、その鍵にECS権限は無いので本番はECS_*必須。
//   コンテナ側は台帳(credits/)を読めない・書けない。残高はジョブ仕様に埋めて渡す(構造的に顧客が書き換えられない)。
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ECSClient, RunTaskCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import { randomBytes } from "crypto";

const REGION = process.env.AWS_REGION || "ap-northeast-1";
const BUCKET = process.env.YUKI_BUCKET || "byakuyaai-media";
const CLUSTER = process.env.YUKI_CLUSTER || "byakuyaai-yuki";
const TASK_FAMILY = process.env.YUKI_TASK_FAMILY || "byakuyaai-yuki-runtime";
const SUBNETS = (process.env.YUKI_SUBNETS || "subnet-049397212207354d4,subnet-0b9757a5beaaee0bf").split(",").map((s) => s.trim()).filter(Boolean);
const SECURITY_GROUP = process.env.YUKI_SECURITY_GROUP || "sg-068936bf2c51b9eb0";
const JPY_PER_USD = 150;  // 内部固定レート(設計§9)
export const PLAN_CAP_USD: Record<string, number> = { premium: 20000 / JPY_PER_USD, test: 20000 / JPY_PER_USD, standard: 20 };
export const RESERVE_USD = 0.05;
export const PAID_TOOL_LABELS: Record<string, string> = { "mcp__byakuyaai__render_lambda": "ユキクレジット(再レンダー・少量)", "mcp__byakuyaai__seedance_regenerate": "制作クレジット 1" };
const CLIENT_RE = /^(?!\.+$)[a-z0-9][a-z0-9_.-]{0,39}$/i;
const JOB_RE = /^[a-z0-9-]{8,64}$/i;
const LOCK_TTL_MS = 15 * 60 * 1000;

function creds() {
  const ak = process.env.ECS_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
  const sk = process.env.ECS_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
  return ak && sk ? { accessKeyId: ak, secretAccessKey: sk } : undefined;
}
function s3Creds() {
  // 開発時のみ: S3とECSで別の鍵を使えるようにする(本番は byakuyaai-control-plane の1組で両方)
  const ak = process.env.YUKI_S3_AWS_ACCESS_KEY_ID || "", sk = process.env.YUKI_S3_AWS_SECRET_ACCESS_KEY || "";
  return ak && sk ? { accessKeyId: ak, secretAccessKey: sk } : creds();
}
let _s3: S3Client | null = null, _ecs: ECSClient | null = null;
const s3 = () => (_s3 ??= new S3Client({ region: REGION, credentials: s3Creds() }));
const ecs = () => (_ecs ??= new ECSClient({ region: REGION, credentials: creds() }));
export const cpConfigured = () => !!(process.env.ECS_AWS_ACCESS_KEY_ID && process.env.ECS_AWS_SECRET_ACCESS_KEY);

async function getJson<T>(key: string): Promise<{ value: T | null; etag: string | null }> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await r.Body!.transformToString("utf-8");
    return { value: JSON.parse(body) as T, etag: r.ETag ?? null };
  } catch (e) {
    const name = (e as { name?: string })?.name || "";
    if (name === "NoSuchKey" || name === "NotFound") return { value: null, etag: null };
    throw e;
  }
}
/** 条件付きPUT(If-Match / If-None-Match:*)で原子更新。競合は "conflict" */
async function putJsonIf(key: string, value: unknown, etag: string | null): Promise<"ok" | "conflict"> {
  try {
    await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: JSON.stringify(value), ContentType: "application/json", ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }) }));
    return "ok";
  } catch (e) {
    const st = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (st === 412 || st === 409) return "conflict";
    throw e;
  }
}
const putJson = (key: string, value: unknown) => s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: JSON.stringify(value), ContentType: "application/json" }));

// ---------- 台帳(ユキクレジット) ----------
export type Ledger = { cap_usd: number; used_usd: number; reserve_usd: number; jobs: Array<{ job_id: string; at: string; cost_usd: number; tools_cost_usd: number }> };
export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const ledgerKey = (clientId: string) => `credits/${clientId}/${monthKey()}.json`;
export function capFor(plan: string | undefined): number { return PLAN_CAP_USD[String(plan || "").toLowerCase()] ?? PLAN_CAP_USD.standard; }

export async function readLedger(clientId: string, plan?: string): Promise<Ledger> {
  const { value } = await getJson<Ledger>(ledgerKey(clientId));
  if (value) return value;
  return { cap_usd: capFor(plan), used_usd: 0, reserve_usd: RESERVE_USD, jobs: [] };
}
/** 精算(冪等: 同じjob_idは二度足さない)。最大6回の条件付きPUT再試行 */
export async function settleLedger(clientId: string, plan: string | undefined, job: { job_id: string; cost_usd: number; tools_cost_usd: number }): Promise<Ledger> {
  for (let i = 0; i < 6; i++) {
    const { value, etag } = await getJson<Ledger>(ledgerKey(clientId));
    const led: Ledger = value ?? { cap_usd: capFor(plan), used_usd: 0, reserve_usd: RESERVE_USD, jobs: [] };
    if (led.jobs.some((j) => j.job_id === job.job_id)) return led;
    const add = Math.max(0, Number(job.cost_usd) || 0) + Math.max(0, Number(job.tools_cost_usd) || 0);
    const next: Ledger = { ...led, used_usd: +(led.used_usd + add).toFixed(6), jobs: [...led.jobs.slice(-400), { job_id: job.job_id, at: new Date().toISOString(), cost_usd: job.cost_usd, tools_cost_usd: job.tools_cost_usd }] };
    if ((await putJsonIf(ledgerKey(clientId), next, etag)) === "ok") return next;
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 200));
  }
  throw new Error("ledger_conflict");
}
const STAGES = ["たっぷり余裕があります", "順調にご活用中です", "そろそろ今月の上限に近づいています", "今月の枠を使い切りました"];
/** 表示用(数字は10%刻みだけ・生の金額は返さない) */
export function creditsView(led: Ledger): { stage: string; pct10: number; exhausted: boolean } {
  const pct = led.cap_usd > 0 ? Math.min(100, Math.round((led.used_usd / led.cap_usd) * 10) * 10) : 0;
  const exhausted = led.cap_usd - led.used_usd <= RESERVE_USD;
  return { stage: exhausted ? STAGES[3] : pct >= 80 ? STAGES[2] : pct >= 40 ? STAGES[1] : STAGES[0], pct10: exhausted ? 100 : pct, exhausted };
}

// ---------- ロック(顧客ごと同時1ジョブ) ----------
const lockKey = (clientId: string) => `jobs/${clientId}/_lock.json`;
export async function acquireLock(clientId: string, jobId: string): Promise<boolean> {
  const { value, etag } = await getJson<{ job_id: string; at: number }>(lockKey(clientId));
  if (value && Date.now() - Number(value.at) < LOCK_TTL_MS) return false;
  return (await putJsonIf(lockKey(clientId), { job_id: jobId, at: Date.now() }, etag)) === "ok";
}
export async function releaseLock(clientId: string, jobId: string): Promise<void> {
  const { value } = await getJson<{ job_id: string }>(lockKey(clientId));
  if (!value || value.job_id !== jobId) return;
  try { await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: lockKey(clientId) })); } catch {}
}

// ---------- ジョブ ----------
export type PaidGrant = { tool: string; args_hash: string };
export type JobMeta = { job_id: string; client_id: string; task_arn: string; started_at: string; prompt: string; settled: boolean; status: "running" | "done" | "error"; error?: string; session_id?: string; cost_usd?: number; tools_cost_usd?: number; warm?: boolean; thread_id?: string };
const WORKER_FRESH_MS = 15_000;  // 心拍がこの範囲なら常駐ワーカーへ enqueue(RunTaskしない)
const metaKey = (c: string, j: string) => `jobs/${c}/${j}/meta.json`;

export async function startJob(p: { clientId: string; clientName: string; plan?: string; prompt: string; paidGrant?: PaidGrant | null; threadId?: string | null }): Promise<{ ok: true; job_id: string; thread_id: string } | { ok: false; error: string }> {
  if (!CLIENT_RE.test(p.clientId)) return { ok: false, error: "invalid_client" };
  const jobId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  if (!(await acquireLock(p.clientId, jobId))) return { ok: false, error: "busy" };
  try {
    const led = await readLedger(p.clientId, p.plan);
    const remaining = +(led.cap_usd - led.used_usd).toFixed(4);
    // スレッド(相談の器): 会話の文脈=Agent SDKのセッションはスレッド単位。記憶(memory/)は全スレッド共通
    const threadId = p.threadId && THREAD_RE.test(p.threadId) ? p.threadId : `t${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
    const thread = (await getJson<ThreadDoc>(threadKey(p.clientId, threadId))).value;
    const job = {
      prompt: p.prompt.slice(0, 8000), client_name: p.clientName, session_id: thread?.session_id || null, thread_id: threadId,
      credits: { cap_usd: led.cap_usd, used_usd: led.used_usd, remaining_usd: remaining },
      paid_grant: p.paidGrant ?? null,
    };
    const prefix = `jobs/${p.clientId}/${jobId}/`;
    await putJson(prefix + "job.json", job);
    // 常駐ワーカー(前の仕事の後10分居残り)が生きていれば、タスクを起こさず待ち行列に置く=数秒で応答
    const worker = (await getJson<{ task_arn?: string; at?: number; busy?: boolean }>(`jobs/${p.clientId}/_worker.json`)).value;
    if (worker && Date.now() - Number(worker.at) < WORKER_FRESH_MS && !worker.busy) {
      await putJson(`jobs/${p.clientId}/_queue/${jobId}.json`, { at: Date.now() });
      const meta: JobMeta = { job_id: jobId, client_id: p.clientId, task_arn: String(worker.task_arn || ""), started_at: new Date().toISOString(), prompt: p.prompt.slice(0, 4000), settled: false, status: "running", warm: true, thread_id: threadId };
      await putJson(metaKey(p.clientId, jobId), meta);
      return { ok: true, job_id: jobId, thread_id: threadId };
    }
    // 起動物: コード束 + node_modules/python 環境のS3キャッシュ(署名付きGET/PUT・boot.mjs が使う。コンテナにS3権限は要らない)
    let bmeta: { bundle_key: string; lock_hash?: string; py_ver?: string; py_src_url?: string };
    try { bmeta = JSON.parse(await (await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: "build/latest.json" }))).Body!.transformToString("utf-8")); }
    catch { bmeta = { bundle_key: (await (await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: "build/latest.txt" }))).Body!.transformToString("utf-8")).trim() }; }
    const sign = (key: string, put = false) => getSignedUrl(s3(), put ? new PutObjectCommand({ Bucket: BUCKET, Key: key })  /* ContentTypeを署名に入れない(boot側もヘッダを送らない) */ : new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
    const jobUrl = await sign(prefix + "job.json");
    const bundleUrl = await sign(bmeta.bundle_key);
    const cacheEnv: Array<{ name: string; value: string }> = [];
    if (bmeta.lock_hash) { const k = `build/cache/nm-${bmeta.lock_hash}.tgz`; cacheEnv.push({ name: "NM_GET_URL", value: await sign(k) }, { name: "NM_PUT_URL", value: await sign(k, true) }); }
    if (bmeta.py_ver && bmeta.py_src_url) { const k = `build/cache/py-${bmeta.py_ver.replace(/\+/g, "_")}.tgz`; cacheEnv.push({ name: "PY_GET_URL", value: await sign(k) }, { name: "PY_PUT_URL", value: await sign(k, true) }, { name: "PY_SRC_URL", value: bmeta.py_src_url }); }
    const r = await ecs().send(new RunTaskCommand({
      cluster: CLUSTER, launchType: "FARGATE", taskDefinition: TASK_FAMILY, count: 1,
      networkConfiguration: { awsvpcConfiguration: { subnets: SUBNETS, securityGroups: [SECURITY_GROUP], assignPublicIp: "ENABLED" } },
      overrides: { containerOverrides: [{ name: "yuki", environment: [
        { name: "BUNDLE_URL", value: bundleUrl }, { name: "JOB_URL", value: jobUrl }, { name: "JOB_ID", value: jobId }, { name: "CLIENT_ID", value: p.clientId }, { name: "YUKI_MODE", value: "worker" },
        ...cacheEnv,
      ] }] },
      tags: [{ key: "app", value: "yuki" }, { key: "client", value: p.clientId }],
    }));
    if (r.failures?.length || !r.tasks?.length) { await releaseLock(p.clientId, jobId); return { ok: false, error: "run_task_failed:" + (r.failures?.[0]?.reason || "unknown") }; }
    const meta: JobMeta = { job_id: jobId, client_id: p.clientId, task_arn: r.tasks[0].taskArn || "", started_at: new Date().toISOString(), prompt: p.prompt.slice(0, 4000), settled: false, status: "running", thread_id: threadId };
    await putJson(metaKey(p.clientId, jobId), meta);
    return { ok: true, job_id: jobId, thread_id: threadId };
  } catch (e) {
    await releaseLock(p.clientId, jobId);
    return { ok: false, error: "start_failed:" + String((e as Error)?.message ?? e).slice(0, 120) };
  }
}

export type PollResult = { ok: true; events: unknown[]; cursor: string; done: boolean; status: JobMeta["status"]; error?: string; credits?: ReturnType<typeof creditsView> } | { ok: false; error: string };

/** 断片を cursor(最後に読んだキー)以降だけ返す。result.json が出ていれば精算して done */
export async function pollJob(clientId: string, jobId: string, cursor: string, plan?: string): Promise<PollResult> {
  if (!CLIENT_RE.test(clientId) || !JOB_RE.test(jobId)) return { ok: false, error: "invalid" };
  const prefix = `jobs/${clientId}/${jobId}/`;
  const meta = (await getJson<JobMeta>(metaKey(clientId, jobId))).value;
  if (!meta) return { ok: false, error: "not_found" };
  const list = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix + "ev-", ...(cursor ? { StartAfter: cursor } : {}) }));
  const keys = (list.Contents ?? []).map((o) => o.Key!).sort();
  const events: unknown[] = [];
  for (const k of keys) {
    try { const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: k })); events.push(...(JSON.parse(await r.Body!.transformToString("utf-8")) as unknown[])); } catch {}
  }
  const newCursor = keys.length ? keys[keys.length - 1] : cursor;
  if (meta.settled) return { ok: true, events, cursor: newCursor, done: true, status: meta.status, error: meta.error, credits: creditsView(await readLedger(clientId, plan)) };
  const result = (await getJson<{ ok: boolean; error?: string; cost_usd?: number; tools_cost_usd?: number; session_id?: string }>(prefix + "result.json")).value;
  if (result) {
    const led = await settleLedger(clientId, plan, { job_id: jobId, cost_usd: Number(result.cost_usd) || 0, tools_cost_usd: Number(result.tools_cost_usd) || 0 });
    const text = await collectText(clientId, jobId);
    await settleThread(clientId, meta.thread_id || "legacy", meta.prompt, text, result.ok ? result.session_id : undefined, jobId);
    const m2: JobMeta = { ...meta, settled: true, status: result.ok ? "done" : "error", error: result.ok ? undefined : String(result.error || "failed").slice(0, 200), session_id: result.session_id, cost_usd: result.cost_usd, tools_cost_usd: result.tools_cost_usd };
    await putJson(metaKey(clientId, jobId), m2);
    await releaseLock(clientId, jobId);
    return { ok: true, events, cursor: newCursor, done: true, status: m2.status, error: m2.error, credits: creditsView(led) };
  }
  const age = Date.now() - new Date(meta.started_at).getTime();
  // 常駐ワーカーへ渡した仕事が90秒たっても動き出さない(断片ゼロ)→ワーカー死亡とみなし、次回はRunTaskに戻す
  if (meta.warm && age > 90_000 && !cursor && !keys.length) {
    const m2: JobMeta = { ...meta, settled: true, status: "error", error: "worker_unresponsive" };
    await putJson(metaKey(clientId, jobId), m2);
    try { await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `jobs/${clientId}/_worker.json` })); } catch {}
    try { await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `jobs/${clientId}/_queue/${jobId}.json` })); } catch {}
    await releaseLock(clientId, jobId);
    return { ok: true, events, cursor: newCursor, done: true, status: "error", error: "ユキの応答がありませんでした。もう一度お送りください", credits: creditsView(await readLedger(clientId, plan)) };
  }
  // 結果が無いまま長い→タスクの生死を見る(コールドスタート≒2分を考慮して4分以降)
  if (age > 4 * 60 * 1000 && meta.task_arn) {
    try {
      const d = await ecs().send(new DescribeTasksCommand({ cluster: CLUSTER, tasks: [meta.task_arn] }));
      const t = d.tasks?.[0];
      if (!t || t.lastStatus === "STOPPED") {
        const m2: JobMeta = { ...meta, settled: true, status: "error", error: "task_stopped:" + String(t?.stoppedReason || "unknown").slice(0, 120) };
        await putJson(metaKey(clientId, jobId), m2); await releaseLock(clientId, jobId);
        return { ok: true, events, cursor: newCursor, done: true, status: "error", error: "処理が途中で止まりました。もう一度お送りください", credits: creditsView(await readLedger(clientId, plan)) };
      }
    } catch {}
  }
  if (age > 25 * 60 * 1000) { await releaseLock(clientId, jobId); return { ok: true, events, cursor: newCursor, done: true, status: "error", error: "timeout" }; }
  return { ok: true, events, cursor: newCursor, done: false, status: "running" };
}

// ---------- スレッド(相談の器)・会話記録(S3) ----------
//   workspace/{client}/desk/threads.json            = { threads: [{id,title,archived,updated_at,last_preview}] }
//   workspace/{client}/desk/threads/{id}.json       = { messages: [{role,content,at,job_id}], session_id }
//   記憶(memory/)は全スレッド共通=分かれるのは会話の文脈だけ(設計書§3)
export type TranscriptMsg = { role: "user" | "assistant"; content: string; at: string; job_id?: string };
export type ThreadMeta = { id: string; title: string; archived: boolean; updated_at: string; last_preview: string };
type ThreadDoc = { messages: TranscriptMsg[]; session_id?: string };
const THREAD_RE = /^[a-z0-9]{6,32}$/i;
const threadsKey = (c: string) => `workspace/${c}/desk/threads.json`;
const threadKey = (c: string, t: string) => `workspace/${c}/desk/threads/${t}.json`;

/** 全断片からユキの発話(text)を集めて1本にする */
async function collectText(clientId: string, jobId: string): Promise<string> {
  const prefix = `jobs/${clientId}/${jobId}/`;
  const list = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix + "ev-" }));
  let text = "";
  for (const k of (list.Contents ?? []).map((o) => o.Key!).sort()) {
    try {
      const evs = JSON.parse(await (await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: k }))).Body!.transformToString("utf-8")) as Array<{ type?: string; text?: string }>;
      for (const e of evs) { if (e.type === "text_start" && text && !text.endsWith("\n\n")) text += "\n\n"; if (e.type === "text" && e.text) text += e.text; }
    } catch {}
  }
  return text.trim();
}

/** 旧形式(単一スレッド: desk/transcript.json + desk/session.json)があれば「これまでの相談」スレッドに取り込む */
async function migrateLegacy(clientId: string): Promise<void> {
  const legacy = (await getJson<{ messages: TranscriptMsg[] }>(`workspace/${clientId}/desk/transcript.json`)).value;
  if (!legacy?.messages?.length) return;
  const sess = (await getJson<{ session_id?: string }>(`workspace/${clientId}/desk/session.json`)).value;
  const id = "legacy";
  await putJson(threadKey(clientId, id), { messages: legacy.messages.slice(-200), session_id: sess?.session_id } as ThreadDoc);
  const last = legacy.messages[legacy.messages.length - 1];
  await putJson(threadsKey(clientId), { threads: [{ id, title: "これまでの相談", archived: false, updated_at: last.at || new Date().toISOString(), last_preview: String(last.content || "").slice(0, 40) }] });
  try { await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `workspace/${clientId}/desk/transcript.json` })); } catch {}
}

export async function listThreads(clientId: string): Promise<ThreadMeta[]> {
  if (!CLIENT_RE.test(clientId)) return [];
  let idx = (await getJson<{ threads: ThreadMeta[] }>(threadsKey(clientId))).value;
  if (!idx) { await migrateLegacy(clientId); idx = (await getJson<{ threads: ThreadMeta[] }>(threadsKey(clientId))).value; }
  return (idx?.threads ?? []).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
export async function readThread(clientId: string, threadId: string): Promise<TranscriptMsg[]> {
  if (!CLIENT_RE.test(clientId) || !THREAD_RE.test(threadId)) return [];
  return ((await getJson<ThreadDoc>(threadKey(clientId, threadId))).value?.messages ?? []).slice(-80);
}
/** 片付ける=アーカイブ(物理削除はしない・設計書§8) */
export async function archiveThread(clientId: string, threadId: string, archived = true): Promise<boolean> {
  if (!CLIENT_RE.test(clientId) || !THREAD_RE.test(threadId)) return false;
  for (let i = 0; i < 4; i++) {
    const { value, etag } = await getJson<{ threads: ThreadMeta[] }>(threadsKey(clientId));
    const threads = (value?.threads ?? []).map((t) => (t.id === threadId ? { ...t, archived } : t));
    if ((await putJsonIf(threadsKey(clientId), { threads }, etag)) === "ok") return true;
  }
  return false;
}
/** スレッド題: 最初の依頼文から。承認IDや記号を外し、最初の意味の区切りまで(最大14字)。ユキ自身の命名は後日 */
function threadTitle(prompt: string): string {
  let s = prompt.replace(/APR-[a-z0-9-]+/gi, "").replace(/[「」『』()（）\[\]【】]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^(まず|あと|えっと|すみません|お疲れ様です|こんにちは)[、,\s]*/u, "");
  const cut = s.split(/[。．!！?？
]/)[0] || s;
  const t = cut.replace(/(してください|して欲しい|してほしい|お願いします|ください)$/u, "").trim();
  return (t || s).slice(0, 14) || "相談";
}
/** 精算時: スレッドの会話記録・セッション・索引 */
async function settleThread(clientId: string, threadId: string, prompt: string, text: string, sessionId: string | undefined, jobId: string) {
  const at = new Date().toISOString();
  const doc = (await getJson<ThreadDoc>(threadKey(clientId, threadId))).value ?? { messages: [] };
  const msgs = [...doc.messages, { role: "user" as const, content: prompt.slice(0, 4000), at, job_id: jobId }, ...(text ? [{ role: "assistant" as const, content: text.slice(0, 20000), at, job_id: jobId }] : [])].slice(-200);
  await putJson(threadKey(clientId, threadId), { messages: msgs, session_id: sessionId || doc.session_id } as ThreadDoc);
  for (let i = 0; i < 4; i++) {
    let { value, etag } = await getJson<{ threads: ThreadMeta[] }>(threadsKey(clientId));
    if (!value) { await migrateLegacy(clientId); ({ value, etag } = await getJson<{ threads: ThreadMeta[] }>(threadsKey(clientId))); }
    const threads = [...(value?.threads ?? [])];
    const preview = (text || prompt).replace(/[#*`>\n]+/g, " ").trim().slice(0, 40);
    const i0 = threads.findIndex((t) => t.id === threadId);
    if (i0 >= 0) threads[i0] = { ...threads[i0], updated_at: at, last_preview: preview };
    else threads.push({ id: threadId, title: threadTitle(prompt), archived: false, updated_at: at, last_preview: preview });
    if ((await putJsonIf(threadsKey(clientId), { threads: threads.slice(-50) }, etag)) === "ok") return;
  }
}
/** 後方互換: 直近スレッドの会話(旧 /history 用) */
export async function readTranscript(clientId: string): Promise<TranscriptMsg[]> {
  const th = await listThreads(clientId);
  const t = th.find((x) => !x.archived);
  return t ? readThread(clientId, t.id) : [];
}

// ---------- ノート(記憶)の閲覧・読み取り専用 ----------
export async function listNotes(clientId: string): Promise<Array<{ path: string; size: number; updated_at: string }>> {
  if (!CLIENT_RE.test(clientId)) return [];
  const prefix = `workspace/${clientId}/memory/`;
  const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (r.Contents ?? []).filter((o) => o.Key!.endsWith(".md")).map((o) => ({ path: o.Key!.slice(prefix.length), size: o.Size ?? 0, updated_at: o.LastModified?.toISOString() ?? "" })).sort((a, b) => (a.path === "INDEX.md" ? -1 : b.path === "INDEX.md" ? 1 : a.path.localeCompare(b.path)));
}
export async function readNote(clientId: string, p: string): Promise<string | null> {
  if (!CLIENT_RE.test(clientId) || !/^[a-z0-9_\-/]{1,80}\.md$/i.test(p) || p.includes("..")) return null;
  try { return await (await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: `workspace/${clientId}/memory/${p}` }))).Body!.transformToString("utf-8"); } catch { return null; }
}
