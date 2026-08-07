import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllClients } from "@/app/_lib/sheets";
import { getProperties, isPropertyVisible, type PropertyRow } from "@/app/_lib/properties";
import { PortfolioView } from "../_components/PortfolioView";
import { toCustomerData, toViewProperty, type ViewProperty } from "../_lib/viewModel";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";

// force-dynamic per design §0/§7.1: "掲載中" と読める場所は書き込み側の状態に
// 一切依存せず、読み取りのたびに可視性を独立再計算する。SSG+deploy-hook方式
// (フックの発火という新たな非同期依存)は不採用 — 毎リクエストSheetsを読む。
// The v4 UI package's own page.tsx used `generateStaticParams`/`dynamicParams
// = false` (a static customer registry) — that data-source layer
// (app/f/_data/_registry.ts etc.) is intentionally not wired in here; see
// app/f/_lib/viewModel.ts's header comment.
export const dynamic = "force-dynamic";

const SITE_URL = "https://byakuyaai.com";

async function resolveClient(slug: string) {
  const clients = await getAllClients();
  return (
    clients.find(
      (c) => c.portfolio_slug === slug && isFlagOn(c.portfolio_enabled)
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
    (p: PropertyRow) => !p.client_id || p.client_id === client.client_id
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

  // isPropertyVisible の3重ガードを通った行だけを表示対象にする(§2.1)。
  // v4パッケージ自体には無かった「成約から7日間はバッジ表示」機能
  // (isRecentlyClosed)はここでは採用していない — 非表示は常に安全側の
  // 判断であり、コンプラ要件(isPropertyVisible経由の可視物件のみ表示)を
  // 満たす上では省いても後退にならない。
  const visible = own
    .filter((p: PropertyRow) => isPropertyVisible(p, now) && gated(p))
    .sort((a: PropertyRow, b: PropertyRow) =>
      (b.published_at || "").localeCompare(a.published_at || "")
    );

  const properties: ViewProperty[] = visible.map((row, index) =>
    toViewProperty(row, index)
  );

  const customer = toCustomerData(client, properties);

  return (
    <PortfolioView
      customer={customer}
      properties={properties}
      pageUrl={`${SITE_URL}/f/${slug}`}
    />
  );
}
