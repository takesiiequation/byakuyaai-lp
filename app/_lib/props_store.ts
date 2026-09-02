// 動画props(設計図)のS3保管・読み書き(2026-09-01 M3)
// テナント分離の憲法: パスは props/{client_id}/{approval_id}.json 固定。
//   - client_id はサーバが承認行から決める。顧客の入力では絶対に変えられない
//   - 書き込み時に「他テナントの素材URLが混じっていないか」を最終ゲートで検査
// 依存を増やさないため AWS SDK は使わず、SigV4署名を自前で組んで fetch する。
import { createHash, createHmac } from "crypto";

const REGION = "ap-northeast-1";
const BUCKET = "byakuyaai-media";
const HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`;
const APPROVAL_RE = /^APR-[a-z0-9]+-[a-f0-9]+$/i;
const CLIENT_RE = /^[a-z0-9_.-]{1,40}$/i;

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest();

/** S3にSigV4署名付きでリクエスト。鍵が無ければnull(呼び出し側はfail-soft) */
async function s3Fetch(method: "GET" | "PUT", key: string, body?: string): Promise<Response | null> {
  const ak = process.env.AWS_ACCESS_KEY_ID;
  const sk = process.env.AWS_SECRET_ACCESS_KEY;
  if (!ak || !sk) return null;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");
  const canonicalUri = "/" + key.split("/").map(encodeURIComponent).join("/");
  const canonicalHeaders = `host:${HOST}
x-amz-content-sha256:${payloadHash}
x-amz-date:${amzDate}
`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const NL = String.fromCharCode(10);
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join(NL);
  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join(NL);
  const kDate = hmac("AWS4" + sk, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, "s3");
  const signature = createHmac("sha256", hmac(kService, "aws4_request")).update(stringToSign).digest("hex");

  return fetch(`https://${HOST}${canonicalUri}`, {
    method,
    headers: {
      Host: HOST,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
}

/** props/{client_id}/{approval_id}.json — 引数が汚れていたら組み立てない(パス脱出の防止) */
export function propsKey(clientId: string, approvalId: string): string | null {
  if (!CLIENT_RE.test(clientId) || !APPROVAL_RE.test(approvalId)) return null;
  return `props/${clientId}/${approvalId}.json`;
}

/** 読み取り。テナント外・不正キー・未作成は null(fail-soft) */
export async function loadProps(clientId: string, approvalId: string): Promise<Record<string, unknown> | null> {
  const key = propsKey(clientId, approvalId);
  if (!key) return null;
  try {
    const res = await s3Fetch("GET", key);
    if (!res || !res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 書き込み。旧版を history/ に退避してから上書き(取り返しがつく) */
export async function saveProps(
  clientId: string,
  approvalId: string,
  props: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const key = propsKey(clientId, approvalId);
  if (!key) return { ok: false, error: "invalid_ids" };
  // テナント混入の最終ゲート: props内の素材URLが他社領域を指していないか
  const bad = findForeignAsset(props, clientId);
  if (bad) return { ok: false, error: `foreign_asset:${bad.slice(0, 80)}` };
  try {
    const prev = await loadProps(clientId, approvalId);
    if (prev) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const h = await s3Fetch("PUT", `props/${clientId}/history/${approvalId}-${stamp}.json`, JSON.stringify(prev));
      if (!h) return { ok: false, error: "s3_not_configured" };
    }
    const res = await s3Fetch("PUT", key, JSON.stringify(props));
    if (!res) return { ok: false, error: "s3_not_configured" };
    if (!res.ok) return { ok: false, error: `s3_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}

/** props内のS3素材URLが自テナント配下かを走査。違反していたら最初の1件を返す */
export function findForeignAsset(o: unknown, clientId: string, depth = 0): string | null {
  if (depth > 12) return null;
  if (typeof o === "string") {
    if (o.includes("byakuyaai-media") && !o.includes(`/${clientId}/`)) return o;
    return null;
  }
  if (Array.isArray(o)) {
    for (const v of o) {
      const r = findForeignAsset(v, clientId, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) {
      const r = findForeignAsset(v, clientId, depth + 1);
      if (r) return r;
    }
  }
  return null;
}
