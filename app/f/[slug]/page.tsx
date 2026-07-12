import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllClients } from "@/app/_lib/sheets";
import {
  getProperties,
  isPropertyVisible,
  isRecentlyClosed,
  type PropertyRow,
} from "@/app/_lib/properties";
import { PortfolioView, type DisplayProperty } from "../_components/PortfolioView";

// force-dynamic per design §0/§7.1: "掲載中" と読める場所は書き込み側の状態に
// 一切依存せず、読み取りのたびに可視性を独立再計算する。SSG+deploy-hook方式
// (フックの発火という新たな非同期依存)は不採用 — 毎リクエストSheetsを読む。
export const dynamic = "force-dynamic";

const SITE_URL = "https://byakuyaai.com";

async function resolveClient(slug: string) {
  const clients = await getAllClients();
  return (
    clients.find(
      (c) => c.portfolio_slug === slug && c.portfolio_enabled === "true"
    ) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await resolveClient(slug);
  if (!client) return { title: "ページが見つかりません" };

  const title = `${client.client_name || slug} | 施工実績・取扱物件`;
  return {
    title,
    description: `${client.client_name || slug}の取扱物件・SNS動画実績ポートフォリオ。`,
    alternates: { canonical: `${SITE_URL}/f/${slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 2層ゲート・レイヤー1(クライアント単位、design §7.2 point 1): slugが
  // 契約社リストのどの行とも一致しない、または portfolio_enabled !== 'true'
  // の行としか一致しない場合は404(is_demoスラッグ相当は/f/demoが別ルートで
  // 処理するため、このルートには存在しない)。
  const client = await resolveClient(slug);
  if (!client) notFound();

  const allProps = await getProperties(client.line_data_sheet_id);
  // 冗長 client_id 一致チェック(design §1.2: コストゼロの保険)。空文字は
  // レガシー行としてフェイルオープンで通す — 可視性そのものはガード3層で
  // 別途厳格に判定されるため、この一致チェックの緩さがコンプラ抜け穴には
  // ならない。
  const own = allProps.filter(
    (p) => !p.client_id || p.client_id === client.client_id
  );

  // force-dynamic RSC, executed fresh per request — this IS the design §0
  // "read-time recompute" principle in action, not the CSR re-render
  // staleness the purity lint rule guards against.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  // 2層ゲート・レイヤー2(物件単位、design §7.2 point 2): status='active'で
  // かつ3ガード通過でも、物件.portfolio_enabled !== true の行は/fに出さない
  // (LINE回答には出す — isPropertyVisible単体はここではANDされない)。
  const gated = (p: PropertyRow) => p.portfolio_enabled === true;

  const visibleActive: DisplayProperty[] = own
    .filter((p) => isPropertyVisible(p, now) && gated(p))
    .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""))
    .map((row) => ({ row, closed: false }));

  const recentlyClosed: DisplayProperty[] = own
    .filter((p) => isRecentlyClosed(p, now) && gated(p))
    .sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || ""))
    .map((row) => ({ row, closed: true }));

  return (
    <PortfolioView
      clientName={client.client_name || slug}
      pageBaseUrl={`${SITE_URL}/f/${slug}`}
      licenseNumber={client.license_number}
      transactionType={client.transaction_type_default}
      properties={[...visibleActive, ...recentlyClosed]}
    />
  );
}
