// Server-only relay helpers for the customer-facing telop revision flow.
// Both app/revise/[approvalId]/page.tsx and app/api/revise/*/route.ts
// call these functions — the backend relay URL and key never reach the client.

const INFO_URL = process.env.REVISE_INFO_URL;
const SUBMIT_URL = process.env.REVISE_SUBMIT_URL;
const REVISE_KEY = process.env.REVISE_RELAY_KEY;

export const APPROVAL_ID_RE = /^APR-[a-z0-9]+-[a-f0-9]{16,}$/i;
export const ROLE_RE = /^[a-z][a-z0-9_]{0,49}$/i;
export const MAX_TEXT_LEN = 120;

export interface ReviseTelop {
  role: string;
  label: string;
  text: string;
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
  new_text: string;
}

export interface ReviseSubmitResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/**
 * Validate + relay an edit request to the backend. Only `role` and `new_text`
 * are ever forwarded — nothing else from the incoming payload reaches it.
 */
export async function submitRevise(
  approvalId: string,
  edits: ReviseEditInput[]
): Promise<ReviseSubmitResult> {
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return { ok: false, error: "invalid_approval_id" };
  }
  if (!Array.isArray(edits) || edits.length === 0) {
    return { ok: false, error: "edits_required" };
  }

  const cleanEdits: ReviseEditInput[] = [];
  for (const e of edits) {
    const role = e?.role;
    const text = e?.new_text;
    if (typeof role !== "string" || !ROLE_RE.test(role)) {
      return { ok: false, error: "invalid_role" };
    }
    if (typeof text !== "string") {
      return { ok: false, error: "invalid_text" };
    }
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LEN) {
      return { ok: false, error: "invalid_text" };
    }
    cleanEdits.push({ role, new_text: trimmed });
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
