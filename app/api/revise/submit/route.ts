import { NextRequest, NextResponse } from "next/server";
import {
  APPROVAL_ID_RE,
  MAX_CAPTION_LEN,
  MAX_TEXT_LEN,
  ROLE_RE,
  submitRevise,
  type ReviseEditInput,
} from "@/app/_lib/revise";

export async function POST(req: NextRequest) {
  let body: { approvalId?: unknown; edits?: unknown; caption_edit?: unknown };
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

  // `edits` may be omitted/empty when a caption-only change is being sent.
  const editsRaw = body?.edits ?? [];
  if (!Array.isArray(editsRaw)) {
    return NextResponse.json(
      { ok: false, error: "invalid_edits" },
      { status: 400 }
    );
  }

  // Allow-list only: pull role/new_text out of whatever the client sent and
  // drop everything else. Nothing beyond these two fields, in this exact
  // shape, is ever forwarded to the backend relay (submitRevise() re-checks
  // the same rules server-side as a second line of defense).
  const edits: ReviseEditInput[] = [];
  for (const e of editsRaw) {
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
    // Telops render on a single line in the video — collapse newlines to
    // spaces here too (the client already does this before sending; this is
    // the second line of defense, mirroring submitRevise()'s own check).
    const trimmed = newText.replace(/\r\n|\r|\n/g, " ").trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { ok: false, error: "invalid_text" },
        { status: 400 }
      );
    }
    edits.push({ role, new_text: trimmed });
  }

  // `caption_edit` is optional and only allow-listed as a trimmed string —
  // it lets the customer update the post caption without touching telops or
  // re-rendering the video. Same allow-list discipline: nothing else from
  // the request body reaches submitRevise()/the backend relay.
  let captionEdit: string | undefined;
  const captionEditRaw = body?.caption_edit;
  if (captionEditRaw !== undefined) {
    if (typeof captionEditRaw !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_caption" },
        { status: 400 }
      );
    }
    const trimmedCaption = captionEditRaw.trim();
    if (trimmedCaption.length === 0 || trimmedCaption.length > MAX_CAPTION_LEN) {
      return NextResponse.json(
        { ok: false, error: "invalid_caption" },
        { status: 400 }
      );
    }
    captionEdit = trimmedCaption;
  }

  if (edits.length === 0 && captionEdit === undefined) {
    return NextResponse.json(
      { ok: false, error: "nothing_to_submit" },
      { status: 400 }
    );
  }

  const result = await submitRevise(approvalId, edits, captionEdit);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
