import type { PropertyRow } from "@/app/_lib/properties";

// 初音坂デモ (sales-outreach sample, same is_demo=true pattern as
// app/f/_data/shirokanedai.ts / app/f/demo/page.tsx). Unlike 白金台
// (transcribed from an in-house sample マイソク of a real-style but
// unattributed listing), 初音坂レジデンス is a wholly fictional property
// created specifically for this purpose — see
// fudosan-video/docs/sample_property/property_spec.md, whose 架空表記
// section documents the deliberate non-collision choices (invented
// building name, real ward + invented town name 初音坂, invented station
// name with no line name given). All factual fields below are transcribed
// verbatim from that spec. No claims beyond what that document states.
//
// is_demo=true means isPropertyVisible() bypasses the whole state machine
// (§2.1) — this row is not read from Sheets at all and never expires/closes.
export const HATSUNEZAKA_CLIENT_NAME = "ByakuyaAI ポートフォリオサンプル";
export const HATSUNEZAKA_TAGLINE =
  "AIが自動生成する物件ポートフォリオページのサンプルです(初音坂レジデンスは架空物件・実在しません)。実際の運用では取扱物件が自動的に並びます。";

// The current 物件 DB schema (PropertyRow, app/_lib/properties.ts) has no
// image/gallery column at all — viewModel.ts's toViewProperty() always maps
// posterUrl to "" regardless of this row's contents (single-video, no-photo
// vessel; see PropertyCard.tsx/FeedCard.tsx, which likewise render exactly
// one posterUrl and one videoUrl, no gallery). app/f/hatsunezaka/page.tsx
// works around this by overriding posterUrl locally with [0] below rather
// than editing the shared viewModel.ts. The remaining 5 are copied into
// public/f/hatsunezaka/ for other outbound use (sales email attachments
// etc.) but are not wired into any render slot on this page today.
export const HATSUNEZAKA_GALLERY_PHOTOS = [
  "/f/hatsunezaka/01_exterior.jpg",
  "/f/hatsunezaka/04_ldk_wide_a.jpg",
  "/f/hatsunezaka/06_kitchen.jpg",
  "/f/hatsunezaka/07_bathroom.jpg",
  "/f/hatsunezaka/09_bedroom.jpg",
  "/f/hatsunezaka/10_balcony_view.jpg",
] as const;

export const hatsunezakaProperty: PropertyRow = {
  property_key: "demo::初音坂レジデンス",
  client_id: "demo",
  property_name: "初音坂レジデンス",
  property_name_normalized: "初音坂レジデンス",
  status: "active",
  is_demo: true,
  deal_type: "賃貸",
  address: "東京都渋谷区初音坂三丁目5-8",
  nearest_station: "「初音坂」駅 徒歩6分",
  floor_plan: "1LDK",
  floor_area_m2: 40.15,
  floor_number: "5階 / SRC造7階建",
  building_age_years: 4,
  monthly_rent_yen: 198000,
  sale_price_yen: 0,
  management_fee_yen: 10000,
  deposit_key_money_note: "敷金1ヶ月・礼金1ヶ月(更新料: 新賃料1ヶ月分)",
  price_label: "19.8万円/月",
  key_features_json: JSON.stringify([
    "オートロック",
    "宅配ボックス",
    "TVモニター付インターホン",
    "浴室乾燥機・追い焚き機能",
    "独立洗面台",
    "温水洗浄便座",
    "シューズインクローゼット",
    "バルコニー(南向き)",
  ]),
  catch_copy_1:
    "築4年・南向きバルコニーの明るい1LDK。オートロック・宅配ボックス完備で、単身〜二人暮らしに使いやすい住まいです。",
  catch_copy_2:
    "浴室乾燥機・追い焚き機能、独立洗面台などの設備を備えた40㎡超の住空間。ペット相談可(小型犬・猫)。",
  caption_instagram: "",
  caption_tiktok: "",
  staged: false,
  video_url_raw: "",
  // Placed demo asset (実生成デモ・9:16) rather than left empty — unlike
  // shirokanedai's row, this page is meant to actually play in outreach.
  video_url_permanent: "/guide/pair_demo_ldk.mp4",
  approval_id: "",
  exec_id: "",
  manifest_url: "",
  portfolio_enabled: true,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
  published_at: "2026-07-22T00:00:00.000Z",
  expires_at: "",
  closed_at: "",
  closed_reported_by: "",
  rejected_at: "",
};
