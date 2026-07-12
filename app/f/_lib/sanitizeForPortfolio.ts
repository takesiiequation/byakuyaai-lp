// Defensive text filter for /f-page copy sourced from マイソク OCR (物件.
// catch_copy_1/2, key_features_json entries, caption_instagram/tiktok).
// See docs/property_db_f_design.md §7.3: Sheets-sourced free text MUST be
// run through this before it is ever rendered, and this module MUST NEVER
// throw — a single bad OCR string (a stray "完全" or "日本一" the マイソク
// itself printed) must never crash the whole portfolio page.
//
// Handoff note (front-f, 2026-07-12): the design doc's §7.3 assumes a
// separate `_lib/validate.ts` — part of the 36-file v4 UI package the
// design references (docs/f_page_v4_integration_plan.md) — whose BANNED_WORDS
// check throws at import time (a startup crash risk it explicitly warns
// about). That package was not found anywhere on this machine when this
// file was written (checked Desktop/Downloads/OneDrive/projects/session
// scratchpads). This module intentionally does NOT replicate an
// import-time-throw variant — see §7.3's own warning about that being a
// pure availability bug, independent of compliance. It only ever replaces
// text, never throws, never crashes the page.
//
// Deliberately narrower than app/_lib/bannedWords.ts's n8n "shape"/"valueless"
// list: that list's "shape" category (L字/アイランドキッチン/大理石 etc.) is
// conditionally allowed when actually マイソク-verified (n8n's Caption Writer
// checks against the source マイソク text before removing them) — a
// verification step this simple, no-Sheets-lookup filter can't replicate.
// Real マイソク copy legitimately says "大理石フロア"; blanking that out
// here would just make accurate listings look broken. This filter instead
// targets the unconditionally-risky category: 景表法 優良/有利誤認 absolute
// and superlative claims (the terms the v4 integration plan's compliance
// briefing calls out: 完全/絶対/日本一/激安等) — kept as a small local
// constant (no Sheets I/O) so this filter is synchronous and can never fail
// due to a network/auth problem elsewhere in the app.
const BANNED_WORDS = [
  "完全",
  "絶対",
  "日本一",
  "業界一",
  "激安",
  "最安値",
  "no.1",
  "ナンバーワン",
  "100%",
  "絶対に",
  "必ず",
  "断言",
  "初期費用ゼロ",
];

function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** True if `text` contains any banned word (case/width-insensitive). Never throws. */
export function containsBannedWord(text: string | null | undefined): boolean {
  const s = typeof text === "string" ? text : "";
  if (!s) return false;
  const normalized = normalizeForMatch(s);
  return BANNED_WORDS.some((w) => normalized.includes(normalizeForMatch(w)));
}

/**
 * Sanitizes a single free-text field for /f display. A banned-word hit
 * blanks the whole field out (a safe, silent fallback) rather than trying
 * to auto-rewrite it — inventing replacement marketing copy would itself be
 * a fresh compliance risk (景表法), so "say nothing" is the only safe
 * fallback here. Non-string/empty input is safe and returns "".
 */
export function sanitizeForPortfolio(text: string | null | undefined): string {
  const s = typeof text === "string" ? text : "";
  if (!s) return "";
  return containsBannedWord(s) ? "" : s;
}

/**
 * Same idea for a list of short strings (e.g. key_features_json parsed to
 * string[]) — drops individual offending entries rather than discarding the
 * whole list, so one bad OCR line doesn't wipe out every feature bullet.
 */
export function sanitizeListForPortfolio(items: string[]): string[] {
  return items.filter((item) => !containsBannedWord(item));
}

/**
 * Parses 物件.key_features_json (a JSON-array-of-strings column) defensively
 * and sanitizes the result. Malformed JSON, a non-array, or non-string
 * entries all fail soft to [] / are dropped — never throws.
 */
export function parseAndSanitizeFeatures(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const strings = parsed.filter((x): x is string => typeof x === "string");
  return sanitizeListForPortfolio(strings);
}
