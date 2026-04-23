import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const SITE_TITLE = "ByakuyaAI | 不動産SNS動画の自動生成・自動投稿サービス";
const SITE_DESCRIPTION =
  "物件写真とマイソクをアップロードするだけで、Instagram・TikTok・YouTube向けのプロ品質ショート動画をAIが毎日自動生成・自動投稿。バーチャルステージング対応、月10万円から。賃貸・売買どちらにも対応、家族経営の不動産屋さま歓迎。";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | ByakuyaAI",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "不動産SNS代行",
    "不動産SNS運用代行",
    "不動産 TikTok 集客",
    "不動産 Instagram 集客",
    "不動産 AI 動画生成",
    "物件紹介動画 自動生成",
    "バーチャルステージング AI",
    "マイソク 動画化",
    "不動産ショート動画",
    "賃貸仲介 SNS",
    "売買仲介 SNS",
    "不動産集客 自動化",
    "SNS自動投稿",
    "ByakuyaAI",
    "白夜AI",
  ],
  alternates: {
    canonical: "https://byakuyaai.com",
  },
  openGraph: {
    title: SITE_TITLE,
    description:
      "写真を送るだけ。あとはAIが全部やります。物件写真→プロ品質のショート動画を毎日自動生成・自動投稿。",
    url: "https://byakuyaai.com",
    siteName: "ByakuyaAI",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description:
      "写真を送るだけ。あとはAIが全部やります。物件写真→プロ品質のショート動画を毎日自動生成・自動投稿。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  metadataBase: new URL("https://byakuyaai.com"),
};

export const viewport: Viewport = {
  themeColor: "#f7931e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
