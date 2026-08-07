import type { Client } from "./types";
import { todayJstDateString } from "./jst";
import { isFlagOn } from "./portalSubmitShared";

// Single source of truth for "今月の利用数" on the client portal — mirrors
// the n8n-side reset check byte-for-byte (scripts/build_v14_drip_scheduling.py,
// 認証+回数制限ノード):
//
//   const todayJst = new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
//   let quotaReset = (d.quota_reset || '').toString().slice(0,10);
//   if (quotaReset && todayJst >= quotaReset) { used = 0; ... }
//
// This is a plain "YYYY-MM-DD" *string* comparison against the exact reset
// date (quota_reset is normally "翌月1日" but can be any date — an admin can
// set it by hand), NOT a (year, month) bucket compare. The dashboard badge
// (app/portal/page.tsx) and the submit-form gate (portalSubmit.ts's
// quotaState) both call effectiveUsed()/quotaSummary() here so they can
// never disagree with each other or with n8n about whether today's quota is
// already reset.
export function effectiveUsed(client: Client): number {
  // 2026-08-08 監査: n8n側(認証+回数制限)は quota_no_reset === 'true' のとき
  // 月次リセットを行わない(使い切り型・trial等)。ここが未対応だと、リセット日を
  // 過ぎた瞬間からポータルの残数表示と送信ゲートだけが「満タン」になり、
  // 実際にはn8nが従来の消化数で弾く恒久的な食い違いになる。
  if (isFlagOn(client.quota_no_reset)) return client.used_this_month;
  const reset = (client.quota_reset || "").toString().slice(0, 10);
  if (reset && todayJstDateString() >= reset) return 0;
  return client.used_this_month;
}

export interface QuotaSummary {
  /** monthly_quota as-is; <= 0 means quota is unconfigured for this client. */
  quota: number;
  /** used_this_month, reset-aware (see effectiveUsed). */
  used: number;
  /** max(0, quota - used) — never negative even if used somehow exceeds quota. */
  remaining: number;
}

export function quotaSummary(client: Client): QuotaSummary {
  const quota = client.monthly_quota || 0;
  const used = effectiveUsed(client);
  return { quota, used, remaining: Math.max(0, quota - used) };
}
