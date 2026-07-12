import type { Metadata } from "next";
import type { CustomerData, TradeType } from "../_data/types";
import { PortfolioView } from "../_components/PortfolioView";
import { toViewProperty, initialAvatarDataUri, type ViewProperty } from "../_lib/viewModel";
import {
  shirokanedaiProperty,
  SHIROKANEDAI_CLIENT_NAME,
  SHIROKANEDAI_TAGLINE,
} from "../_data/shirokanedai";

// 白金台デモ (design §7.1 exception): fully static — no Sheets read, no
// force-dynamic. This is deliberately the ONE static /f route; every real
// client page (/f/[slug]) is force-dynamic per §0/§7.1's read-time-recompute
// principle. Once the 物件DB is live this row is meant to be folded into a
// real is_demo=true 物件 row (design §7.1's own noted follow-up) — until
// then this static file is the sole source. Data itself is unchanged from
// the pre-v4 implementation (shirokanedai.ts); only the rendered UI (v4's
// PortfolioView composition) changes here.
export const metadata: Metadata = {
  title: "ポートフォリオサンプル | ByakuyaAI",
  description:
    "ByakuyaAIが自動生成する物件ポートフォリオページのサンプル表示です。",
  robots: { index: false, follow: true },
};

// No real 契約社リスト row backs this page (client_id would be "demo", not a
// real client) — CustomerData is built by hand rather than via
// viewModel.ts's toCustomerData(client, …), with fields honestly labeled as
// sample/non-real rather than left blank or guessed.
const DEMO_CUSTOMER: CustomerData = {
  slug: "demo",
  company: SHIROKANEDAI_CLIENT_NAME,
  licenseNo: "(サンプル表示のため非掲載)",
  lineUrl: "https://byakuyaai.com/",
  tel: "",
  logoUrl: initialAvatarDataUri(SHIROKANEDAI_CLIENT_NAME),
  catchCopy: SHIROKANEDAI_TAGLINE,
  tradeType: "仲介" as TradeType,
  address: undefined,
  companyDescription:
    "ByakuyaAIが自動生成する物件ポートフォリオページの操作感を確認いただくためのサンプルです。実際の運用では契約中の顧客の取扱物件が自動的に並びます。",
  properties: [],
};

export default function DemoPortfolioPage() {
  const properties: ViewProperty[] = [toViewProperty(shirokanedaiProperty, 0)];

  return (
    <PortfolioView
      customer={DEMO_CUSTOMER}
      properties={properties}
      pageUrl="https://byakuyaai.com/f/demo"
      demoNotice="これはサービス紹介用のサンプル表示です。実際の募集物件ではありません。"
    />
  );
}
