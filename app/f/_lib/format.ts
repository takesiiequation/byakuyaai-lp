export function formatRent(rentMan: number): string {
  return `${rentMan}万円`;
}

export function formatSize(sizeSqm: number): string {
  return `${sizeSqm}m²`;
}

// v4 original always rendered `徒歩${walkMin}分`. The current 物件 DB schema
// has no dedicated walk-minutes column — viewModel.ts best-effort parses it
// out of the free-text nearest_station field and falls back to NaN when it
// can't (see viewModel.ts parseStationAndWalk). Rendering "徒歩0分"/"徒歩NaN分"
// for that fallback would assert a specific, unverified walking time — an
// affirmative false claim the rest of this codebase deliberately avoids
// (compare sanitizeForPortfolio.ts, PropertyJsonLd's video-omission rule).
// Returning "" instead just omits the badge/segment at those call sites.
export function formatWalk(walkMin: number): string {
  if (!Number.isFinite(walkMin) || walkMin <= 0) return "";
  return `徒歩${walkMin}分`;
}

export function formatManagementFee(managementFeeYen: number): string {
  if (managementFeeYen <= 0) {
    return "管理費・共益費なし";
  }
  return `管理費${managementFeeYen.toLocaleString("ja-JP")}円`;
}

export function formatDepositKey(depositMan: number, keyMoneyMan: number): string {
  const depositLabel = depositMan > 0 ? `敷金${depositMan}万円` : "敷金なし";
  const keyMoneyLabel = keyMoneyMan > 0 ? `礼金${keyMoneyMan}万円` : "礼金なし";
  return `${depositLabel} / ${keyMoneyLabel}`;
}
