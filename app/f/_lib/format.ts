import type { PropertyRow } from "@/app/_lib/properties";

/** Yen formatting shared by PropertyCard/ComplianceFooter — Intl handles the
 * ja-JP thousands separators; callers append the unit character themselves
 * since "円" placement differs (headline price vs. "管理費○円" note). */
export function formatYen(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("ja-JP");
}

/**
 * Headline price string for a card. Prefers the pre-formatted price_label
 * (design §1.2 row18 — "再フォーマットしない=二重整形バグを避ける": the
 * extractor's own price_full_ja is the source of truth when present). Falls
 * back to a plain yen-figure derivation from monthly_rent_yen/sale_price_yen
 * only for legacy/incomplete rows that predate that column being populated.
 */
export function priceHeadline(row: PropertyRow): string {
  if (row.price_label) return row.price_label;
  if (row.deal_type === "売買" && row.sale_price_yen > 0) {
    return `${formatYen(row.sale_price_yen)}円`;
  }
  if (row.monthly_rent_yen > 0) {
    return `${formatYen(row.monthly_rent_yen)}円/月`;
  }
  return "価格応相談";
}

/** Compliance-required management-fee note (design §1.2 row16 — 杉田コンプラ
 * 要件: 賃料と管理費の併記必須). Empty when the field hasn't been populated
 * (legacy rows from before this extraction field existed). */
export function managementFeeNote(row: PropertyRow): string {
  if (!(row.management_fee_yen > 0)) return "";
  return `管理費${formatYen(row.management_fee_yen)}円`;
}

export function floorSummary(row: PropertyRow): string {
  return [row.floor_plan, row.floor_area_m2 > 0 ? `${row.floor_area_m2}㎡` : ""]
    .filter(Boolean)
    .join(" / ");
}
