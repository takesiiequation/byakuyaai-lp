// Server-only relay helpers for the customer-facing telop revision flow.
// Both app/revise/[approvalId]/page.tsx and app/api/revise/*/route.ts
// call these functions — the backend relay URL and key never reach the client.

const INFO_URL = process.env.REVISE_INFO_URL;
const SUBMIT_URL = process.env.REVISE_SUBMIT_URL;
const REVISE_KEY = process.env.REVISE_RELAY_KEY;

export const APPROVAL_ID_RE = /^APR-[a-z0-9]+-[a-f0-9]{16,}$/i;
export const ROLE_RE = /^[a-z][a-z0-9_]{0,49}$/i;
export const MAX_TEXT_LEN = 35;
export const MAX_CAPTION_LEN = 2200;

// Reading override ("yomi"): this box now holds the *full narration script*
// for the line (prefilled from the current script, kanji included) rather
// than a word-level phonetic hint — the customer rewrites only the part
// that's mispronounced and sends the rest back verbatim. Kanji/CJK is
// therefore allowed. We only block characters that could break TTS or leak
// markup: C0/C1 control characters (incl. newlines/line separators —
// narration is read as one continuous line), emoji/pictographs, and angle
// brackets (blocks HTML-tag-like input outright).
//
// Built from codepoint ranges (rather than typed inline as literal unicode
// escapes) so the forbidden set stays legible and auditable as plain hex.
const YOMI_FORBIDDEN_RANGES: Array<[number, number]> = [
  [0x0000, 0x001f], // C0 controls, incl. \t \n \r
  [0x007f, 0x009f], // DEL + C1 controls
  [0x2028, 0x2029], // line/paragraph separator
  [0x200d, 0x200d], // zero-width joiner (emoji sequences)
  [0xfe0f, 0xfe0f], // variation selector-16 (emoji presentation)
  [0x20e3, 0x20e3], // combining enclosing keycap
  [0x2600, 0x27bf], // misc symbols + dingbats
  [0x2b00, 0x2bff], // misc symbols and arrows
  [0x1f1e6, 0x1f1ff], // regional indicators (flag emoji)
  [0x1f300, 0x1faff], // main emoji / pictograph block
];
const YOMI_FORBIDDEN_SRC =
  "<>" +
  YOMI_FORBIDDEN_RANGES.map(([a, b]) =>
    a === b
      ? `\\u{${a.toString(16)}}`
      : `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`
  ).join("");
/** True (via `.test()`) when the whole string is free of forbidden chars —
 * matches the historical allow-list calling convention at every call site. */
export const YOMI_RE = new RegExp(`^[^${YOMI_FORBIDDEN_SRC}]*$`, "u");
export const MAX_YOMI_LEN = 120;

export interface ReviseTelop {
  role: string;
  label: string;
  /** On-screen telop text (the subtitle actually burned into the video). */
  text: string;
  /** Current narration script for this line — what TTS actually reads.
   * Falls back to `text` server-side when the backend has no separate
   * narration script (older manifests). */
  yomi: string;
}

export interface ReviseInfo {
  ok: boolean;
  approval_id?: string;
  status?: string;
  editable?: boolean;
  property_name?: string;
  client_name?: string;
  video_url?: string;
  telops?: ReviseTelop[];
  caption?: string;
  error?: string;
}

function shapeTelops(raw: unknown): ReviseTelop[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviseTelop[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.role === "string" && typeof rec.text === "string") {
      out.push({
        role: rec.role,
        label: typeof rec.label === "string" && rec.label ? rec.label : rec.role,
        text: rec.text,
        // Defensive fallback to `text` in case the backend is an older
        // deploy that hasn't split display text from narration script yet.
        yomi: typeof rec.yomi === "string" && rec.yomi ? rec.yomi : rec.text,
      });
    }
  }
  return out;
}

/** Fetch the editable telop set for an approval from the backend relay. Never throws. */
export async function getReviseInfo(approvalId: string): Promise<ReviseInfo> {
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return { ok: false, error: "invalid_approval_id" };
  }
  if (!INFO_URL || !REVISE_KEY) {
    return { ok: false, error: "server_not_configured" };
  }

  try {
    const res = await fetch(INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: REVISE_KEY, approval_id: approvalId }),
      cache: "no-store",
    });
    const data: unknown = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { ok: false, error: "upstream_invalid_response" };
    }
    const rec = data as Record<string, unknown>;
    if (!rec.ok) {
      return {
        ok: false,
        error: typeof rec.error === "string" ? rec.error : "not_found",
      };
    }
    return {
      ok: true,
      approval_id:
        typeof rec.approval_id === "string" ? rec.approval_id : approvalId,
      status: typeof rec.status === "string" ? rec.status : undefined,
      editable: rec.editable === true,
      property_name:
        typeof rec.property_name === "string" ? rec.property_name : "",
      client_name: typeof rec.client_name === "string" ? rec.client_name : "",
      video_url: typeof rec.video_url === "string" ? rec.video_url : "",
      telops: shapeTelops(rec.telops),
      caption: typeof rec.caption === "string" ? rec.caption : "",
    };
  } catch {
    return { ok: false, error: "upstream_unreachable" };
  }
}

export interface ReviseEditInput {
  role: string;
  new_text?: string;
  /** Reading-script override: the full narration script to read for this
   * line (e.g. the customer changed how "白金台" reads throughout, not
   * just replaced that one word). Only sent when the customer actually
   * opened and edited the reading box — omitting it lets the backend
   * auto-convert pronunciation from `new_text` instead. */
  yomi?: string;
}

export interface ReviseSubmitResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/**
 * Validate + relay an edit request to the backend. Only `role`, `new_text`,
 * `yomi` and (optionally) `caption_edit` are ever forwarded — nothing else
 * from the incoming payload reaches it. Each edit needs `new_text`, `yomi`,
 * or both (a yomi-only edit re-does the narration without changing the
 * on-screen telop). `edits` may be empty when `captionEdit` is present
 * (caption-only changes don't touch telops), but both being empty is
 * rejected.
 */
export async function submitRevise(
  approvalId: string,
  edits: ReviseEditInput[],
  captionEdit?: string
): Promise<ReviseSubmitResult> {
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return { ok: false, error: "invalid_approval_id" };
  }

  const editsProvided = Array.isArray(edits) ? edits : [];

  let cleanCaption: string | undefined;
  if (captionEdit !== undefined) {
    if (typeof captionEdit !== "string") {
      return { ok: false, error: "invalid_caption" };
    }
    const trimmedCaption = captionEdit.trim();
    if (trimmedCaption.length === 0 || trimmedCaption.length > MAX_CAPTION_LEN) {
      return { ok: false, error: "invalid_caption" };
    }
    cleanCaption = trimmedCaption;
  }

  if (editsProvided.length === 0 && cleanCaption === undefined) {
    return { ok: false, error: "nothing_to_submit" };
  }

  const cleanEdits: ReviseEditInput[] = [];
  for (const e of editsProvided) {
    const role = e?.role;
    if (typeof role !== "string" || !ROLE_RE.test(role)) {
      return { ok: false, error: "invalid_role" };
    }

    const hasNewText = e?.new_text !== undefined;
    const hasYomi = e?.yomi !== undefined;
    // Each edit must carry the telop text, a reading override, or both —
    // never neither (a yomi-only edit is valid: it changes pronunciation
    // without touching the on-screen text).
    if (!hasNewText && !hasYomi) {
      return { ok: false, error: "invalid_edit" };
    }

    const cleanEdit: ReviseEditInput = { role };

    if (hasNewText) {
      const text = e.new_text;
      if (typeof text !== "string") {
        return { ok: false, error: "invalid_text" };
      }
      // Telops may include newlines — a newline renders as a fixed line
      // break at that position in the video. Only the outer edges are
      // trimmed.
      const trimmed = text.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) {
        return { ok: false, error: "invalid_text" };
      }
      cleanEdit.new_text = trimmed;
    }

    if (hasYomi) {
      const yomi = e.yomi;
      if (typeof yomi !== "string") {
        return { ok: false, error: "invalid_yomi" };
      }
      const trimmedYomi = yomi.trim();
      if (
        trimmedYomi.length === 0 ||
        trimmedYomi.length > MAX_YOMI_LEN ||
        !YOMI_RE.test(trimmedYomi)
      ) {
        return { ok: false, error: "invalid_yomi" };
      }
      cleanEdit.yomi = trimmedYomi;
    }

    cleanEdits.push(cleanEdit);
  }

  if (!SUBMIT_URL || !REVISE_KEY) {
    return { ok: false, error: "server_not_configured" };
  }

  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_key: REVISE_KEY,
        approval_id: approvalId,
        edits: cleanEdits,
        ...(cleanCaption !== undefined ? { caption_edit: cleanCaption } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `upstream_error_${res.status}` };
    }
    const data: unknown = await res.json().catch(() => ({}));
    const rec = (data && typeof data === "object" ? data : {}) as Record<
      string,
      unknown
    >;
    return {
      ok: true,
      message: typeof rec.message === "string" ? rec.message : "accepted",
    };
  } catch {
    return { ok: false, error: "upstream_unreachable" };
  }
}
