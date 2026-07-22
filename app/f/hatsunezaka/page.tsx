import type { Metadata } from "next";
import type { CustomerData, TradeType } from "../_data/types";
import { PortfolioView } from "../_components/PortfolioView";
import { toViewProperty, initialAvatarDataUri, type ViewProperty } from "../_lib/viewModel";
import {
  hatsunezakaProperty,
  HATSUNEZAKA_CLIENT_NAME,
  HATSUNEZAKA_TAGLINE,
  HATSUNEZAKA_GALLERY_PHOTOS,
} from "../_data/hatsunezaka";

// 初音坂デモ: same static, is_demo-equivalent pattern as /f/demo
// (app/f/demo/page.tsx) — no Sheets read, no force-dynamic. A second,
// independent sales-outreach sample (架空物件, see
// app/f/_data/hatsunezaka.ts) living at its own URL rather than replacing
// /f/demo's 白金台 content.
export const metadata: Metadata = {
  title: "初音坂レジデンス(サンプル) | ByakuyaAI",
  description:
    "ByakuyaAIが自動生成する物件ポートフォリオページのサンプル表示です(初音坂レジデンスは架空物件)。",
  robots: { index: false, follow: true },
};

// No real 契約社リスト row backs this page (client_id would be "demo", not a
// real client) — CustomerData is built by hand, same as /f/demo, with
// fields honestly labeled as sample/non-real rather than left blank or
// guessed.
const DEMO_CUSTOMER: CustomerData = {
  slug: "demo-hatsunezaka",
  company: HATSUNEZAKA_CLIENT_NAME,
  licenseNo: "(サンプル表示のため非掲載)",
  lineUrl: "https://byakuyaai.com/",
  tel: "",
  logoUrl: initialAvatarDataUri(HATSUNEZAKA_CLIENT_NAME),
  catchCopy: HATSUNEZAKA_TAGLINE,
  tradeType: "仲介" as TradeType,
  address: undefined,
  companyDescription:
    "ByakuyaAIが自動生成する物件ポートフォリオページの操作感を確認いただくためのサンプルです。実際の運用では契約中の顧客の取扱物件が自動的に並びます。",
  properties: [],
};

export default function HatsunezakaPortfolioPage() {
  // PropertyRow has no image column (see hatsunezaka.ts comment) —
  // toViewProperty() always maps posterUrl to "". Override it locally here
  // with the exterior shot so this page (unlike /f/demo's shirokanedai row,
  // which has no photo asset at all) actually shows a thumbnail/poster
  // instead of the neutral placeholder tile.
  const properties: ViewProperty[] = [
    { ...toViewProperty(hatsunezakaProperty, 0), posterUrl: HATSUNEZAKA_GALLERY_PHOTOS[0] },
  ];

  return (
    <PortfolioView
      customer={DEMO_CUSTOMER}
      properties={properties}
      pageUrl="https://byakuyaai.com/f/hatsunezaka"
      demoNotice="これはサービス紹介用のサンプル表示です。掲載物件「初音坂レジデンス」は架空物件であり、実在しません。"
    />
  );
}
