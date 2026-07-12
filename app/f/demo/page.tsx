import type { Metadata } from "next";
import { PortfolioView, type DisplayProperty } from "../_components/PortfolioView";
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
// then this static file is the sole source.
export const metadata: Metadata = {
  title: "ポートフォリオサンプル | ByakuyaAI",
  description:
    "ByakuyaAIが自動生成する物件ポートフォリオページのサンプル表示です。",
  robots: { index: false, follow: true },
};

export default function DemoPortfolioPage() {
  const properties: DisplayProperty[] = [
    { row: shirokanedaiProperty, closed: false },
  ];

  return (
    <PortfolioView
      clientName={SHIROKANEDAI_CLIENT_NAME}
      tagline={SHIROKANEDAI_TAGLINE}
      pageBaseUrl="https://byakuyaai.com/f/demo"
      properties={properties}
      demoNotice="これはサービス紹介用のサンプル表示です。実際の募集物件ではありません。"
    />
  );
}
