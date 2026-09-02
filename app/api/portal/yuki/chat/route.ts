// ユキのデスク チャットAPI(2026-09-02)
// 認証: portal-session のみ(approval_idは使わない=会社スコープ)
// ゲートは毎リクエストでシートから読み直す(adminがOFFにした瞬間に効く)
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { runDesk } from "@/app/_lib/desk";
import { loadJson, saveJson } from "@/app/_lib/props_store";

export const maxDuration = 300;

const friendly = (e: string): string =>
  /^(upstream_|empty_|server_|failed$|unknown)/.test(e) ? "ただいま混み合っています。少し時間をおいてお試しください。" : e;


const RATE_MAX = 12;
const RATE_WINDOW_MS = 60_000;

async function rateLimited(key: string): Promise<boolean> {
  const k = `ratelimit/desk_${key}.json`;
  const now = Date.now();
  const prev = (await loadJson(k)) as { t?: number[] } | null;
  const arr = (prev?.t ?? []).filter((x) => typeof x === "number" && now - x < RATE_WINDOW_MS);
  arr.push(now);
  await saveJson(k, { t: arr.slice(-40) });
  return arr.length > RATE_MAX;
}

export async function POST(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (await rateLimited(clientId)) {
    return NextResponse.json(
      { ok: false, error: "少し間を置いてからお試しください" },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
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
    if (!role || !content || content.length > 4000) {
      return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
    }
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "invalid_messages" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + String.fromCharCode(10)));
        } catch {
          /* 切断時は無視 */
        }
      };
      try {
        const r = await runDesk(
          clientId,
          client.client_name ?? "",
          "",
          messages,
          (text) => send({ type: "msg", text }),
          (ev) => send({ type: "status", ...ev }),
        );
        if (!r.ok) send({ type: "error", error: friendly(r.error ?? "failed") });
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
