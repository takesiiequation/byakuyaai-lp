import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const SITE_TITLE = "ByakuyaAI | 不動産集客をAIで自動化";
const SITE_DESCRIPTION =
  "写真を送るだけ。あとはAIが全部やります。マイソクと物件写真をアップロードするだけで、プロ品質のショート動画を毎日自動で生成・配信。賃貸・売買どちらにも対応。";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "不動産",
    "SNS自動投稿",
    "AI動画生成",
    "バーチャルステージング",
    "Instagram",
    "TikTok",
    "不動産集客",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: "写真を送るだけ。あとはAIが全部やります。",
    url: "https://byakuyaai.com",
    siteName: "ByakuyaAI",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "写真を送るだけ。あとはAIが全部やります。",
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
