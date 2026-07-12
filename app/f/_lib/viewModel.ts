import type { Client } from "@/app/_lib/types";
import type { PropertyRow } from "@/app/_lib/properties";
import type { ActivePropertyVideo, CustomerData, TradeType } from "../_data/types";
import { sanitizeForPortfolio, parseAndSanitizeFeatures } from "./sanitizeForPortfolio";

// Bridges the real DB row shapes (app/_lib/properties.ts PropertyRow, the
// "唯一の実体" per design doc §7.3, and app/_lib/types.ts Client) to the v4
// UI package's own view-model shapes (app/f/_data/types.ts CustomerData /
// ActivePropertyVideo). The v4 package's OWN data source
// (app/f/_data/_registry.ts / sample.ts / index.ts, and its import-time-
// throwing validate.ts) is intentionally never imported by the live routes
// — see app/f/[slug]/page.tsx and app/f/demo/page.tsx. Those 4 files stay in
// the tree (delivered as part of the 36-file package) but are dead code on
// the real request path; app/f/_lib/sanitizeForPortfolio.ts (never-throw)
// remains the one sanitizer actually used to build these view models.
//
// Where v4's schema assumes structured fields the current 物件 DB schema
// (design doc §1.2) doesn't have as separate columns (walkMin, depositMan/
// keyMoneyMan, posterUrl, tel, logoUrl, catchCopy...), this file picks
// honest, non-fabricated fallbacks documented inline below — never a
// fabricated fact, per the same principle sanitizeForPortfolio.ts already
// enforces for banned words.

/** Neutral brand-gradient placeholder tile — used only when no real poster
 * image exists (今日時点、物件DBに poster/thumbnail 列自体が無いため常時).
 * Deliberately NOT photo-like (no fabricated property photo). Empty
 * `posterUrl` (not this constant) is what callers should compare against —
 * this constant is applied at render sites in PropertyCard.tsx/FeedCard.tsx,
 * NOT baked into the mapped data itself, so Hero3D's
 * `posters.filter(Boolean)` still correctly sees an empty list and skips the
 * poster-drift layer instead of drifting 4 identical placeholder tiles.
 */
export const PLACEHOLDER_POSTER_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='568'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23262219'/><stop offset='100%' stop-color='%23141210'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/></svg>`
  );

export function initialAvatarDataUri(name: string): string {
  const initial = (name || "?").trim().charAt(0) || "?";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' rx='48' fill='%23f7931e'/><text x='50%' y='54%' font-family='sans-serif' font-size='42' font-weight='700' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'>${initial}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const WALK_MINUTES_RE = /徒歩\s*(\d+)\s*分/;

/** nearest_station is a single マイソク free-text field (e.g. "東京メトロ
 * 南北線・都営三田線「白金台駅」徒歩10分") — 宅建業法の表示規約上ほぼ必ず
 * 徒歩N分を含む。best-effort に抜き出し、駅名側は末尾の徒歩表記を削って
 * stationName に渡す。抽出できない行は walkMin=undefined とし、
 * format.ts 側のガードで空文字表示にする(「徒歩0分」という捏造した精度を
 * 主張しない — see format.ts formatWalk). */
function parseStationAndWalk(nearestStation: string): {
  stationName: string;
  walkMin: number;
} {
  const trimmed = (nearestStation || "").trim();
  const match = trimmed.match(WALK_MINUTES_RE);
  if (!match) return { stationName: trimmed, walkMin: NaN };
  const walkMin = Number(match[1]);
  const stationName = trimmed.replace(WALK_MINUTES_RE, "").trim();
  return { stationName, walkMin: Number.isFinite(walkMin) ? walkMin : NaN };
}

/** address is a full free-text string (e.g. "東京都港区白金台5丁目") — area
 * best-effort takes the prefecture+city/ward prefix (up to 区/市/町/村) for
 * the GridView area filter dropdown. Falls back to the full address when no
 * such suffix is found rather than guessing further. */
function deriveArea(address: string): string {
  const trimmed = (address || "").trim();
  const match = trimmed.match(/^.{2,10}?[都道府県].{1,10}?[区市町村]/);
  return match ? match[0] : trimmed;
}

export interface ViewProperty extends ActivePropertyVideo {
  /** Free-text 敷金・礼金 note straight from 物件.deposit_key_money_note
   * (already sanitized). The current DB schema has no structured
   * depositMan/keyMoneyMan split (v4's own fields, always 0 below) — showing
   * v4's formatDepositKey(0, 0) ("敷金なし・礼金なし") when a note is
   * actually on file would be an affirmative false claim. PropertyCard.tsx /
   * FeedCard.tsx prefer this field over formatDepositKey() when non-empty
   * (documented at both call sites). */
  depositKeyNote: string;
  /** 物件.staged (design doc §7.4: "staged=true→PropertyCardに「※家具・
   * 小物はイメージです」強制表示"). v4's own PropertyVideo type has no
   * staging concept — PropertyCard.tsx/FeedCard.tsx render a small badge
   * when this is true, mirroring the pre-v4 implementation. */
  staged: boolean;
}

/** Maps one visible 物件 row (already filtered by isPropertyVisible +
 * per-property portfolio_enabled — this function does no gating itself) to
 * the v4 UI's ActivePropertyVideo shape. `order` mirrors the caller's sort
 * position (published_at desc), matching current /f/[slug] ordering. */
export function toViewProperty(row: PropertyRow, order: number): ViewProperty {
  const { stationName, walkMin } = parseStationAndWalk(row.nearest_station);
  const uploadDate = row.published_at || row.created_at || "";

  return {
    id: row.property_key,
    title: sanitizeForPortfolio(row.property_name) || "物件",
    area: deriveArea(row.address),
    address: sanitizeForPortfolio(row.address),
    rentMan: row.monthly_rent_yen > 0 ? row.monthly_rent_yen / 10000 : 0,
    managementFeeYen: row.management_fee_yen,
    // No structured deposit/key-money numeric split in the current schema —
    // see ViewProperty.depositKeyNote above. Left at 0/0 intentionally; do
    // not read these two fields directly in new UI code, use
    // depositKeyNote instead.
    depositMan: 0,
    keyMoneyMan: 0,
    depositKeyNote: sanitizeForPortfolio(row.deposit_key_money_note),
    staged: row.staged,
    layout: row.floor_plan,
    sizeSqm: row.floor_area_m2,
    walkMin,
    availableFrom: undefined,
    structure: undefined,
    // video_url_permanent only — video_url_raw is a ~3-day-volatile URL (see
    // design doc §1.2 row23); never render it on a page that can stay
    // cached/indexed. Matches the current PropertyCard.tsx / PropertyJsonLd
    // convention this replaces.
    videoUrl: row.video_url_permanent,
    // Left empty on purpose — no poster/thumbnail image column exists in the
    // 物件 DB schema yet (Phase2 follow-up). Render sites fall back to
    // PLACEHOLDER_POSTER_DATA_URI; Hero3D's posters.filter(Boolean) will
    // correctly treat this as "no poster" rather than drifting a repeated
    // placeholder tile.
    posterUrl: "",
    status: "active",
    tags: parseAndSanitizeFeatures(row.key_features_json),
    description: sanitizeForPortfolio(row.catch_copy_1) || undefined,
    stationName: stationName || undefined,
    floor: row.floor_number || undefined,
    buildingAge: row.building_age_years > 0 ? row.building_age_years : undefined,
    order,
    // jsonld.ts's buildGraph() throws if uploadDate is falsy — the caller
    // (PortfolioView) must only pass rows with a non-empty uploadDate into
    // <PropertyJsonLd active=...>, not this raw mapped list. See
    // jsonLdEligible() below.
    uploadDate,
    videoDurationSec: undefined,
    aspect: "9:16",
  };
}

/** Subset of a mapped property list safe to hand to <PropertyJsonLd active=…>
 * — jsonld.ts's buildGraph() throws per-row if uploadDate is empty, and that
 * would crash the whole page's server render (§7.4's "never crash" posture
 * extended to the newly-introduced strict jsonld.ts). Full list still goes
 * to GridView/FeedView for display regardless of uploadDate. */
export function jsonLdEligible(properties: ViewProperty[]): ActivePropertyVideo[] {
  return properties.filter((p) => Boolean(p.uploadDate));
}

/** Real client → v4 CustomerData. Several v4 fields (tel, logoUrl,
 * catchCopy, companyDescription, address) have no backing column on the
 * 契約社リスト sheet (see app/_lib/types.ts Client) — honest fallbacks only,
 * documented per-field. tradeType is typed as the narrow v4 TradeType union
 * ('仲介'|'貸主'|'代理') but transaction_type_default is a free string on
 * the real sheet (could be "専属専任媒介" etc.) — cast through, since
 * nothing in the v4 package branches on tradeType's exact literal value
 * (grep-verified: only ever interpolated as display text in
 * ComplianceFooter/ComplianceSheet/jsonld.ts), so showing the client's real
 * registered value takes priority over conforming to the 3-value enum. */
export function toCustomerData(
  client: Client,
  properties: ActivePropertyVideo[]
): CustomerData {
  return {
    slug: client.portfolio_slug,
    company: client.client_name,
    licenseNo: client.license_number || "",
    // Routed through the tracked /go redirect (3-tier fail-soft resolution
    // in app/go/[client]/[dest]/route.ts) rather than a raw sheet value —
    // never empty/broken even when link_line_url isn't set yet (falls
    // through to hp, then FALLBACK), and clicks get counted like every
    // other /go link on the site.
    lineUrl: `/go/${client.client_id}/line`,
    // No phone-number column exists anywhere in the schema — FeedCard.tsx
    // hides the tel: link entirely when this is empty (see the edit there)
    // rather than rendering a broken `tel:` href with no number.
    tel: "",
    logoUrl: initialAvatarDataUri(client.client_name),
    catchCopy: client.client_name
      ? `${client.client_name}の取扱物件を動画でご紹介します`
      : "取扱物件を動画でご紹介します",
    tradeType: (client.transaction_type_default || "仲介") as TradeType,
    address: undefined,
    companyDescription: undefined,
    // Not read by any live-path component (grep-verified — only
    // _data/index.ts and _lib/validate.ts touch customer.properties, and
    // neither is on the live route), but wired through for real rather than
    // discarded so a future consumer doesn't silently get an empty list.
    properties,
  };
}
