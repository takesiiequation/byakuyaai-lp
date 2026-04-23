import { faqs } from "../_data/faqs";

const SITE_URL = "https://byakuyaai.com";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ByakuyaAI",
  alternateName: "白夜AI",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  email: "info@byakuyaai.com",
  description:
    "不動産向け SNS 動画自動生成サービス。物件写真とマイソクをアップロードするだけで、Instagram/TikTok/YouTube 向けショート動画をプロ品質で自動生成。",
  sameAs: [],
  areaServed: { "@type": "Country", name: "Japan" },
};

const service = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "不動産向けSNS動画自動生成サービス",
  name: "ByakuyaAI",
  provider: { "@type": "Organization", name: "ByakuyaAI", url: SITE_URL },
  areaServed: { "@type": "Country", name: "Japan" },
  description:
    "物件写真とマイソクをアップロードするだけで、バーチャルステージング・ナレーション・テロップ付きのショート動画を AI が自動生成。Instagram/TikTok/YouTube への自動投稿にも対応。",
  offers: [
    {
      "@type": "Offer",
      name: "ライトプラン",
      description: "月10本のAI動画生成、バーチャルステージング対応",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "スタンダードプラン",
      description: "月20本のAI動画生成 + SNS自動投稿 + 効果分析レポート",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "プレミアムプラン",
      description: "毎日自動投稿 + LINE公式AI応答 + バルク物件オンボーディング",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    },
  ],
  audience: {
    "@type": "BusinessAudience",
    audienceType: "不動産事業者・賃貸仲介・売買仲介",
  },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function JsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  );
}
