import type { PropertyRow } from "@/app/_lib/properties";

// 白金台デモ (design §7.1 exception): static, is_demo-equivalent data,
// published ahead of the 物件DB implementation. Source: the ByakuyaAI-branded
// sample マイソク already on file (写真素材2/マイソク_shirokanedai.png,
// footer-watermarked "ByakuyaAI / byakuyaai.com" — an in-house sample
// document, not a live client listing), transcribed verbatim for the
// factual fields. No claims beyond what that sheet states.
//
// is_demo=true means isPropertyVisible() bypasses the whole state machine
// (§2.1) — this row is not read from Sheets at all and never expires/closes.
export const SHIROKANEDAI_CLIENT_NAME = "ByakuyaAI ポートフォリオサンプル";
export const SHIROKANEDAI_TAGLINE =
  "AIが自動生成する物件ポートフォリオページのサンプルです。実際の運用では取扱物件が自動的に並びます。";

// 2026-07-23差し替え: 岡本認定の最高品質Seedance生成映像
// (public/f/demo/shirokanedai_living.mp4)のポスター画像。同じ override
// パターンを hatsunezaka.ts の HATSUNEZAKA_GALLERY_PHOTOS と揃える —
// 現行の物件DBスキーマには poster/thumbnail 列が無いため(viewModel.ts参照)、
// app/f/demo/page.tsx がここで posterUrl をローカル上書きする(共有の
// viewModel.ts 自体は変更しない)。
export const SHIROKANEDAI_POSTER = "/f/demo/shirokanedai_poster.jpg";

export const shirokanedaiProperty: PropertyRow = {
  property_key: "demo::プレステージレジデンス白金台302号室",
  client_id: "demo",
  property_name: "プレステージレジデンス白金台 302号室",
  property_name_normalized: "プレステージレジデンス白金台302号室",
  status: "active",
  is_demo: true,
  deal_type: "賃貸",
  address: "東京都港区白金台5丁目",
  nearest_station: "東京メトロ南北線・都営三田線「白金台駅」徒歩10分",
  floor_plan: "2LDK",
  floor_area_m2: 187.59,
  floor_number: "3階 / 地上5階・地下1階建",
  building_age_years: 1,
  monthly_rent_yen: 3000000,
  sale_price_yen: 0,
  management_fee_yen: 110000,
  deposit_key_money_note: "敷金900万円・礼金300万円(定期借家3年)",
  price_label: "300万円/月",
  key_features_json: JSON.stringify([
    "邸宅サウナ",
    "床暖房",
    "ウォークインクローゼット",
    "ワインセラー",
    "シアタールーム",
    "ゴルフシミュレーター",
    "地下駐車場(大型SUV・EV対応)",
    "24時間有人管理",
  ]),
  catch_copy_1:
    "1フロアわずか1〜3邸の希少性。ワインセラー・シアタールーム・ゴルフシミュレーターを備えた白金台の邸宅レジデンス。",
  catch_copy_2: "新築・大理石フロア・邸宅サウナ完備、ゆとりの187㎡2LDK。",
  caption_instagram: "",
  caption_tiktok: "",
  staged: false,
  // 2026-07-23差し替え: 岡本認定の最高品質Seedance生成映像を配線
  // (以前はこのプロパティ専用の動画素材が無く空文字だった — 現在は
  // public/f/demo/shirokanedai_living.mp4 が実際にこの物件の生成物として
  // 存在する)。
  video_url_raw: "",
  video_url_permanent: "/f/demo/shirokanedai_living.mp4",
  approval_id: "",
  exec_id: "",
  manifest_url: "",
  portfolio_enabled: true,
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
  published_at: "2026-07-12T00:00:00.000Z",
  expires_at: "",
  closed_at: "",
  closed_reported_by: "",
  rejected_at: "",
};
