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

// Still-image swap ("swaps"): scene_index values the customer wants
// re-rendered as a static "photo + slow zoom" instead of the AI video clip
// (used when a clip has a visible glitch, e.g. a warped doorway). Range
// mirrors the n8n-side guard (Revise: Auth+Load) — keep both in sync.
export const MAX_SWAP_SCENE_INDEX = 30;

export interface ReviseTelop {
  role: string;
  label: string;
  /** On-screen telop text (the subtitle actually burned into the video). */
  text: string;
  /** Current narration script for this line — what TTS actually reads.
   * Falls back to `text` server-side when the backend has no separate
   * narration script (older manifests). */
  yomi: string;
  /** Manifest scene_index this line's on-screen visual resolves to, or null
   * when it can't be resolved (older manifests without sd.scenes, or a role
   * — like `exclaim` — that shares another line's clip rather than owning
   * one itself). Cards with `scene_index === null` get no swap toggle. */
  scene_index: number | null;
  /** Thumbnail (the scene's source photo) to show next to the swap toggle.
   * Null when scene_index resolved but no matching klingVideos entry was
   * found (fail-soft — no image malformed, toggle stays hidden). */
  thumbnail: string | null;
  /** True when this scene has already been swapped to the still-image
   * render server-side (Revise: Apply Edits set use_still on the matching
   * klingVideos entry in a prior revision). Swap is one-way — once true,
   * the form shows "差し替え済み" instead of a toggle. */
  swapped: boolean;
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
        // Fail-soft: any shape mismatch here just hides the swap toggle
        // for this card rather than breaking the page.
        scene_index:
          typeof rec.scene_index === "number" &&
          Number.isInteger(rec.scene_index)
            ? rec.scene_index
            : null,
        thumbnail:
          typeof rec.thumbnail === "string" && rec.thumbnail
            ? rec.thumbnail
            : null,
        swapped: rec.swapped === true,
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
 * `yomi`, (optionally) `caption_edit`, and (optionally) `swaps` are ever
 * forwarded — nothing else from the incoming payload reaches it. Each edit
 * needs `new_text`, `yomi`, or both (a yomi-only edit re-does the narration
 * without changing the on-screen telop). `edits` may be empty when
 * `captionEdit` or `swaps` is present (a swaps-only or caption-only request
 * doesn't need telop edits), but all three being empty is rejected.
 */
export async function submitRevise(
  approvalId: string,
  edits: ReviseEditInput[],
  captionEdit?: string,
  swaps?: number[]
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

  // Swap requests: scene_index values to re-render as a static photo
  // instead of the AI video clip. Second line of defense (route.ts already
  // filtered these) — re-validate as true integers 0-MAX_SWAP_SCENE_INDEX
  // and dedupe, mirroring the n8n-side guard (Revise: Auth+Load).
  const swapsProvided = Array.isArray(swaps) ? swaps : [];
  const cleanSwaps = Array.from(
    new Set(
      swapsProvided.filter(
        (n): n is number =>
          typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n <= MAX_SWAP_SCENE_INDEX
      )
    )
  );

  if (
    editsProvided.length === 0 &&
    cleanCaption === undefined &&
    cleanSwaps.length === 0
  ) {
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
        ...(cleanSwaps.length > 0 ? { swaps: cleanSwaps } : {}),
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
