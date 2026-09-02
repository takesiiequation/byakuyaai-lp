import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_ID_RE } from "@/app/_lib/revise";
import { runCompanion } from "@/app/_lib/companion";
import { loadJson, saveJson } from "@/app/_lib/props_store";

export const maxDuration = 60;

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
  const now = Date.now();
  const prev = (await loadJson(k)) as { t?: number[] } | null;
  const arr = (prev?.t ?? []).filter((x) => typeof x === "number" && now - x < RATE_WINDOW_MS);
  arr.push(now);
  await saveJson(k, { t: arr.slice(-40) });
  return arr.length > RATE_MAX;
}

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
    if (!role || !content || content.length > 1000) {
      return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
    }
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
  }

  const result = await runCompanion(approvalId, messages);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
