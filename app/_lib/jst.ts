// Single definition of "何をもって今日/今月とするか (JST)" — mirrors the
// n8n-side convention exactly (scripts/build_v14_drip_scheduling.py の
// 認証+回数制限ノード: `new Date(Date.now()+9*3600*1000)`, then reading its
// UTC getters, which land on JST wall-clock values because the offset was
// baked into the epoch before the read). Both quota.ts (残数計算) and
// sheets.ts's getMonthlyApprovedSlots (投稿カレンダーの「今月」判定) derive
// "today" from here so they can never drift from each other or from the
// backend's own reset/scheduling logic.
export function jstNow(): { year: number; month: number; day: number } {
  const shifted = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1, // 1-12
    day: shifted.getUTCDate(),
  };
}

/** "YYYY-MM-DD" in JST — same shape/semantics as n8n's `todayJst` and as the
 * `quota_reset` column itself, so the two are directly string-comparable. */
export function todayJstDateString(): string {
  const { year, month, day } = jstNow();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${year}-${z(month)}-${z(day)}`;
}
