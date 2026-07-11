import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";

// "docs URLから自動入力" (/admin/models). Fetches a model's docs page, asks
// OpenRouter to extract registration-form fields, and returns them for the
// owner to review/edit — never saved directly (the admin page always routes
// this through the same form + validation as a manual entry).
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ASSIST_MODEL = "anthropic/claude-sonnet-4-6";
const PAGE_FETCH_TIMEOUT_MS = 10_000;
const OPENROUTER_TIMEOUT_MS = 30_000;
const MAX_PAGE_TEXT_CHARS = 20_000;
// Hard cap on raw response bytes we'll ever buffer for the docs page, independent
// of (and in addition to) the post-strip MAX_PAGE_TEXT_CHARS truncation. Guards
// against a huge/malicious response being fully read into memory before we get
// a chance to slice it down.
const MAX_PAGE_RESPONSE_BYTES = 5_000_000; // 5MB

// GET lets the client know whether to show/enable the assist button at all,
// without ever exposing the key itself (fail-soft per the task's env-unset UX).
export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  return Response.json({
    ok: true,
    data: { available: !!process.env.OPENROUTER_API_KEY },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Reads a Response body up to maxBytes, aborting the underlying fetch (via the
// passed AbortController) as soon as the cap is exceeded instead of buffering
// the full body first. Falls back to a plain .text() read (still bounded by
// the caller's Content-Length precheck) if the runtime doesn't expose a
// streamable body.
async function readLimitedText(
  res: Response,
  controller: AbortController,
  maxBytes: number
): Promise<string> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    return res.text();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        const keep = maxBytes - (total - value.byteLength);
        if (keep > 0) chunks.push(value.subarray(0, keep));
        controller.abort();
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors — we're discarding the rest anyway
        }
        break;
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released via cancel()
    }
  }
  const buf = new Uint8Array(total > maxBytes ? maxBytes : total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI応答からJSONを抽出できませんでした");
  }
  const parsed = JSON.parse(candidate.slice(start, end + 1));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("AI応答がJSONオブジェクトではありません");
  }
  return parsed as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "OPENROUTER_API_KEY が未設定です" },
      { status: 400 }
    );
  }

  let targetUrl: string;
  try {
    const body = (await req.json()) as { url?: string };
    targetUrl = (body.url ?? "").trim();
  } catch {
    return Response.json({ ok: false, error: "不正なリクエストです" }, { status: 400 });
  }
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return Response.json(
      { ok: false, error: "有効なdocs URLを指定してください" },
      { status: 400 }
    );
  }

  let pageText: string;
  try {
    const controller = new AbortController();
    // Covers the fetch call AND the body read below — a slow-drip response
    // (bytes trickled in under the size cap) must not be able to hold the
    // request open indefinitely.
    const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
    let raw: string;
    try {
      const pageRes = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ByakuyaAI-Admin/1.0)" },
      });
      if (!pageRes.ok) {
        return Response.json(
          { ok: false, error: `docs URLの取得に失敗しました (HTTP ${pageRes.status})` },
          { status: 400 }
        );
      }
      const declaredLength = Number(pageRes.headers.get("content-length") ?? "");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PAGE_RESPONSE_BYTES) {
        controller.abort();
        return Response.json(
          { ok: false, error: "docs URLのレスポンスサイズが上限を超えています" },
          { status: 400 }
        );
      }
      raw = await readLimitedText(pageRes, controller, MAX_PAGE_RESPONSE_BYTES);
    } finally {
      clearTimeout(timer);
    }
    pageText = stripHtml(raw).slice(0, MAX_PAGE_TEXT_CHARS);
    if (!pageText) {
      return Response.json(
        { ok: false, error: "docs URLからテキストを取得できませんでした" },
        { status: 400 }
      );
    }
  } catch (e) {
    return Response.json(
      { ok: false, error: `docs URLの取得に失敗しました: ${String(e)}` },
      { status: 400 }
    );
  }

  const prompt = `以下はAI動画生成モデルのdocsページから抽出したテキストです。この内容から、管理画面の「モデル登録」フォームに入力する項目をJSONで抽出してください。

出力は次のキーだけを持つ単一のJSONオブジェクトのみを返してください(説明文やコードブロックのマークダウンは付けないでください):
- endpoint_url: string。APIエンドポイントURL(fal.aiのモデルなら通常 https://queue.fal.run/... の形式)
- duration: string。対応する動画の長さ(秒数など、わかる範囲で)
- resolution: string。対応する解像度(例: "720p")。複数ある場合は代表的なもの1つ
- body_template: string。次の形式のJSON文字列にしてください。実際のパラメータ名はdocsに合わせつつ、値の部分は次のプレースホルダ文字列をそのまま使ってください: "{{image_url}}" (入力画像URL・必須), "{{prompt}}" (プロンプト・必須), "{{duration}}", "{{aspect_ratio}}", "{{resolution}}"。例: {"image_url":"{{image_url}}","prompt":"{{prompt}}","duration":"{{duration}}","aspect_ratio":"{{aspect_ratio}}"}
- notes: string。価格・利用制約・注意点などの補足(わかる範囲で。日本語で簡潔に)

docsから読み取れない項目は空文字("")にしてください。JSON以外は一切出力しないでください。

docsテキスト:
"""
${pageText}
"""`;

  let content: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    let orRes: Response;
    try {
      orRes = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ASSIST_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!orRes.ok) {
      const errText = await orRes.text().catch(() => "");
      return Response.json(
        {
          ok: false,
          error: `OpenRouter呼び出しに失敗しました (HTTP ${orRes.status}) ${errText.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }
    const orData = await orRes.json();
    content = orData?.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return Response.json(
        { ok: false, error: "AIから応答がありませんでした" },
        { status: 502 }
      );
    }
  } catch (e) {
    return Response.json(
      { ok: false, error: `OpenRouter呼び出しに失敗しました: ${String(e)}` },
      { status: 502 }
    );
  }

  let extracted: Record<string, unknown>;
  try {
    extracted = extractJsonObject(content);
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }

  const endpointUrl =
    typeof extracted.endpoint_url === "string" ? extracted.endpoint_url.trim() : "";
  if (endpointUrl && !/^https:\/\//i.test(endpointUrl)) {
    return Response.json(
      { ok: false, error: "AIが返したendpoint_urlの形式が不正です(https://で始まる必要があります)" },
      { status: 502 }
    );
  }

  const bodyTemplate =
    typeof extracted.body_template === "string" ? extracted.body_template.trim() : "";
  if (bodyTemplate) {
    try {
      JSON.parse(bodyTemplate);
    } catch {
      return Response.json(
        { ok: false, error: "AIが返したbody_templateが正しいJSON形式ではありません" },
        { status: 502 }
      );
    }
  }

  return Response.json({
    ok: true,
    data: {
      endpoint_url: endpointUrl,
      duration: typeof extracted.duration === "string" ? extracted.duration : "",
      resolution: typeof extracted.resolution === "string" ? extracted.resolution : "",
      body_template: bodyTemplate,
      notes: typeof extracted.notes === "string" ? extracted.notes : "",
    },
  });
}
