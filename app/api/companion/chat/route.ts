import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_ID_RE } from "@/app/_lib/revise";
import { runCompanion } from "@/app/_lib/companion";

export const maxDuration = 60;

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
