import { NextRequest, NextResponse } from "next/server";
import {
  APPROVAL_ID_RE,
  MAX_TEXT_LEN,
  ROLE_RE,
  submitRevise,
  type ReviseEditInput,
} from "@/app/_lib/revise";

export async function POST(req: NextRequest) {
  let body: { approvalId?: unknown; edits?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  const approvalId = body?.approvalId;
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_approval_id" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.edits) || body.edits.length === 0) {
    return NextResponse.json(
      { ok: false, error: "edits_required" },
      { status: 400 }
    );
  }

  // Allow-list only: pull role/new_text out of whatever the client sent and
  // drop everything else. Nothing beyond these two fields, in this exact
  // shape, is ever forwarded to the backend relay (submitRevise() re-checks
  // the same rules server-side as a second line of defense).
  const edits: ReviseEditInput[] = [];
  for (const e of body.edits) {
    const rec = (e && typeof e === "object" ? e : {}) as Record<
      string,
      unknown
    >;
    const role = rec.role;
    const newText = rec.new_text;

    if (typeof role !== "string" || !ROLE_RE.test(role)) {
      return NextResponse.json(
        { ok: false, error: "invalid_role" },
        { status: 400 }
      );
    }
    if (typeof newText !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_text" },
        { status: 400 }
      );
    }
    const trimmed = newText.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { ok: false, error: "invalid_text" },
        { status: 400 }
      );
    }
    edits.push({ role, new_text: trimmed });
  }

  const result = await submitRevise(approvalId, edits);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
