// Server-only relay for the customer-facing "投稿を承認"/"却下" buttons on
// the portal 制作状況 list (StatusRow, pending_approval rows only). This
// closes the gap where approve/reject were only reachable from the
// approval EMAIL's buttons — the portal previously only offered
// "確認・修正する".
//
// It targets the EXACT SAME n8n endpoint the email buttons already submit
// to (see fudosan-video/workflows/approval_handler_v1.json, "ByakuyaAI
// 承認handler v1" / id RrAqJHTLsvTZQqC9):
//   GET  /webhook/post-approval          -> renders a confirm page (no
//                                            side effect — this app never
//                                            calls this leg)
//   POST /webhook/post-approval-confirm  -> body {id, action}, the ONLY
//                                            leg with a side effect. This
//                                            is what the email's HTML
//                                            <form> posts to, and what we
//                                            replicate here.
// The webhook base URL is not a secret (same pattern as app/_lib/billing.ts
// and app/go/[client]/[dest]/route.ts, which also hardcode it) — the only
// unguessable part is the 24-hex-char approval_id itself, which behaves
// like a bearer token.
//
// Double-submit protection is inherited from n8n's own "Decide" code node:
// the FIRST accepted request atomically flips 承認待ち.status to
// "processing"/"rejected", so any second call for the same approval_id
// (this route retried, two tabs, a stale page) gets a non-success heading
// ("処理済み"/"処理中"/"見つかりません") back — we surface that verbatim
// rather than inventing our own duplicate-guard against 承認待ち (which
// this app must never read directly, see below).
//
// Ownership check happens BEFORE this module is called (route.ts calls
// verifyPendingApproval): only a 制作状況 row belonging to the session's
// own client_id, currently resolveStatus()==="pending_approval", may be
// acted on. This module itself never reads the 承認待ち tab — its
// post_data column carries a plaintext Publer API key (see portal.ts's
// header comment for the same rule) — it only ever POSTs {id, action} to
// the confirm webhook and reads back the HTML it returns.

import { APPROVAL_ID_RE } from "./revise";
import { getProductionRows, resolveStatus } from "./portal";

const CONFIRM_URL =
  "https://aiboost-takeshi.app.n8n.cloud/webhook/post-approval-confirm";

export const APPROVAL_ACTIONS = ["approve", "reject"] as const;
export type ApprovalActionKind = (typeof APPROVAL_ACTIONS)[number];

export interface ApprovalActionResult {
  ok: boolean;
  action: ApprovalActionKind;
  /** Customer-facing Japanese, shown on success (n8n's own confirm-page
   * heading, e.g. "承認しました" / "却下しました"). */
  message?: string;
  /** Customer-facing Japanese, shown on failure. Either n8n's own heading
   * (e.g. "処理済み", "期限切れ") surfaced verbatim, or a generic fallback
   * for network/parse failures. Never a raw error code — this route family
   * follows the same "error field is ready-to-display Japanese" convention
   * as /api/portal/auth and /api/portal/submit. */
  error?: string;
}

const SUCCESS_HEADING: Record<ApprovalActionKind, string> = {
  approve: "承認しました",
  reject: "却下しました",
};

const GENERIC_FAILURE = "処理に失敗しました。時間をおいて再度お試しください";

/** Pulls the <h2> heading out of the confirm webhook's HTML response — the
 * only outcome channel it exposes (n8n's "Decide" code node renders a
 * human-facing result page, not JSON). Never throws. */
function extractHeading(html: string): string {
  const m = html.match(/<h2[^>]*>([^<]*)<\/h2>/);
  return m ? m[1].trim() : "";
}

/**
 * Confirms an approval_id belongs to `clientId` AND is still actionable
 * (resolveStatus === "pending_approval"), using ONLY the sanitized 制作状況
 * feed (getProductionRows — already filtered to this client_id, never
 * carries post_data/Publer keys). This is the sole gate against acting on
 * another client's approval_id or replaying an action after the row has
 * already moved on. Fail-soft-safe in the fail-CLOSED direction: any Sheets
 * read failure inside getProductionRows yields [] here, so this returns
 * false (action refused) rather than silently allowing it.
 */
export async function verifyPendingApproval(
  clientId: string,
  approvalId: string
): Promise<boolean> {
  const rows = await getProductionRows(clientId);
  return rows.some(
    (r) => r.approval_id === approvalId && resolveStatus(r) === "pending_approval"
  );
}

/**
 * Calls the same n8n endpoint the approval email's "✅ 投稿OK"/"❌ 却下する"
 * buttons submit to. Never throws — network/parse failures come back as
 * `{ ok: false }` with a generic Japanese message.
 */
export async function callApprovalConfirm(
  approvalId: string,
  action: ApprovalActionKind
): Promise<ApprovalActionResult> {
  if (!APPROVAL_ID_RE.test(approvalId)) {
    return { ok: false, action, error: "不正なリクエストです" };
  }

  let res: Response;
  try {
    res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id: approvalId, action }).toString(),
      cache: "no-store",
    });
  } catch {
    return { ok: false, action, error: GENERIC_FAILURE };
  }

  const html = await res.text().catch(() => "");
  const heading = extractHeading(html);

  if (heading === SUCCESS_HEADING[action]) {
    return { ok: true, action, message: heading };
  }
  // Any other heading (処理済み/期限切れ/見つかりません/処理中/投稿失敗/無効,
  // or an unparsed response) is a non-success — surface n8n's own
  // customer-safe heading verbatim when we have one, generic text otherwise.
  return { ok: false, action, error: heading || GENERIC_FAILURE };
}
