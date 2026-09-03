import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_ID_RE } from "@/app/_lib/revise";
import { runCompanion } from "@/app/_lib/companion";
import { loadJsonEtag, saveJsonIfMatch } from "@/app/_lib/props_store";

// 長文の相談は「道具で情報取得 → 厚い回答生成」で複数往復するため60秒では落ちる(2026-09-02 実測504)。
// 実運用で最も大事な場面なので上限を延ばす。
export const maxDuration = 300;

// 簡易レート制限(2026-09-02 セキュリティ監査): approval_idが漏れた場合に
// 第三者がLLM費用を焼く/修正枠を潰すのを防ぐ。プロセス内メモリなので厳密ではないが、
// 「1本のURLで無限に叩ける」状態を無くすのが目的。
const RATE_MAX = 12;            // 1分あたりの上限
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
function rateLimitedLocal(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 500) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  }
  return arr.length > RATE_MAX;
}

// サーバーレスは各リクエストが別インスタンスになりうるため、プロセス内カウンタだけでは
// 制限が効かない(2026-09-02 実測: 15連打が全通過)。共有ストア(S3)でも数える。
async function rateLimitedShared(key: string): Promise<boolean> {
  const k = `ratelimit/${key}.json`;
  // 読み→書きを条件付きPUTで直列化(並列13連打が全通過した2026-09-04の実測への対策)。衝突したら読み直して最大6回
  for (let attempt = 0; attempt < 6; attempt++) {
    const now = Date.now();
    const { value, etag } = await loadJsonEtag(k);
    const prev = value as { t?: number[] } | null;
    const arr = (prev?.t ?? []).filter((x) => typeof x === "number" && now - x < RATE_WINDOW_MS);
    arr.push(now);
    const r = await saveJsonIfMatch(k, { t: arr.slice(-40) }, etag);
    if (r === "ok") return arr.length > RATE_MAX;
    if (r === "fail") return arr.length > RATE_MAX;  // S3不通時は読めた分で判定(fail-soft)
    await new Promise((res) => setTimeout(res, 40 + Math.floor(Math.random() * 120)));
  }
  return true;  // 6回衝突=明らかな連打 → 制限側に倒す
}

const friendly = (e: string): string =>
  /^(upstream_|empty_|server_|failed$|unknown)/.test(e) ? "ただいま混み合っています。少し時間をおいてお試しください。" : e;

interface Body {
  approvalId?: unknown;
  messages?: unknown;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const approvalId = body?.approvalId;
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return NextResponse.json({ ok: false, error: "invalid_approval_id" }, { status: 400 });
  }

  if (rateLimitedLocal(approvalId) || (await rateLimitedShared(approvalId))) {
    return NextResponse.json(
      { ok: false, error: "少し間を置いてからお試しください(短時間に多くのご依頼をいただいています)" },
      { status: 429 },
    );
  }

  const raw = Array.isArray(body?.messages) ? body.messages : [];
  if (raw.length === 0 || raw.length > 40) {
    return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
  }
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of raw) {
    const rec = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const role = rec.role === "assistant" ? "assistant" : rec.role === "user" ? "user" : null;
    const content = typeof rec.content === "string" ? rec.content.trim() : "";
    // 4000字: お客様が受け取ったメール全文やフィードバックを貼れる長さ(1000字では足りなかった)
    if (!role || !content || content.length > 4000) {
      return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
    }
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
  }

  // 逐次配信(NDJSON): エージェントが話しながら作業する様子をそのまま届ける。
  // 1行1メッセージ {type:"msg",text} / 最後に {type:"done"}。
  // 旧クライアント互換: ?stream=0 で従来のJSON一括応答。
  const wantStream = new URL(req.url).searchParams.get("stream") !== "0";
  if (!wantStream) {
    const result = await runCompanion(approvalId, messages);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + String.fromCharCode(10)));
        } catch {
          /* クライアント切断時は無視 */
        }
      };
      try {
        const result = await runCompanion(
          approvalId,
          messages,
          (text) => send({ type: "msg", text }),
          (ev) => send({ type: "status", ...ev }),
        );
        if (!result.ok) send({ type: "error", error: friendly(result.error ?? "failed") });
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: String(e).slice(0, 120) });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
