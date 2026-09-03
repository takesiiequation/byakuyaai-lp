import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

/* ============================================================
 * /admin/materials — 営業資料棚
 *
 * 「どこに何があるか忘れる」対策(岡本 2026-09-04)。
 * 顧客に見せる資料4つを上に大きく、内部・旧資料は下に小さく。
 * URLはここからコピーして LINE/メールに貼る運用。
 * 資料を増やしたら CUSTOMER / INTERNAL に1行足すだけ。
 * ============================================================ */

const BASE = "https://byakuyaai.com";

type Material = {
  title: string;
  path: string;
  what: string; // 何を見せる資料か
  when: string; // いつ使うか
  status?: "準備中";
};

const CUSTOMER: Material[] = [
  {
    title: "制作事例(動画50秒)",
    path: "/demo",
    what: "実際に納品したショート動画を、開いた瞬間に再生できるページ。下に無料お試しの案内と提案資料へのボタン",
    when: "最初の接点。「まず動画を見てください」の一言と一緒に送る。末尾の ?b=数字 はフォーム営業の文面番号(計測用)なので、顧客に送る時は付けなくてOK",
  },
  {
    title: "提案資料(スタンダード10万／プレミアム30万)",
    path: "/proposal.pdf",
    what: "料金2プラン・コスト比較・導入の流れをまとめた1枚PDF",
    when: "動画を見て興味を持った相手に。商談前の事前共有や、訪問時の手土産に",
  },
  {
    title: "モニタープラン チラシ(県西エリア限定・月3万円)",
    path: "/monitor.pdf",
    what: "先着10社のモニタープラン。月10本・7ヶ月目以降は月5万円。A5印刷用",
    when: "末川さんルート・県西エリアの会社に。印刷して手渡し、またはこのPDFを送る",
  },
  {
    title: "プレミアム提案資料",
    path: "/premium.pdf",
    what: "プレミアムプラン(30万円)単独の提案チラシ。提案資料と同じデザインで作成予定",
    when: "WEBマーケを丸ごと任せたい相手に",
    status: "準備中",
  },
];

// 旧A4資料・ピッチ・HTML版チラシは 2026-09-04 に岡本指示で削除(git 4688305 以前から復元可)。
// 顧客に見せる資料は上の4つだけ。増やす時は岡本の判断を仰ぐ。

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

function Card({ m }: { m: Material }) {
  const url = BASE + m.path;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--brand-ink)]">{m.title}</h3>
            {m.status && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                {m.status}
              </span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-[var(--brand-orange-dark)]">{url}</p>
        </div>
        <div className="flex gap-2">
          {!m.status && (
            <a
              href={m.path}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-[var(--brand-orange)] px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
            >
              開く
            </a>
          )}
          {!m.status && <CopyButton text={url} />}
        </div>
      </div>
      <dl className="mt-3 grid gap-1.5 text-xs text-gray-600 sm:grid-cols-[4rem_1fr]">
        <dt className="font-bold text-gray-400">中身</dt>
        <dd>{m.what}</dd>
        <dt className="font-bold text-gray-400">使う時</dt>
        <dd>{m.when}</dd>
      </dl>
    </div>
  );
}

export default async function MaterialsPage() {
  await checkAuth();
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--brand-ink)] sm:text-2xl">営業資料棚</h1>
        <a
          href="/admin"
          className="text-sm text-gray-500 transition-colors hover:text-[var(--brand-orange)]"
        >
          ← ダッシュボード
        </a>
      </div>

      <h2 className="mb-2 text-sm font-bold text-gray-500">顧客に見せる資料(この4つだけ)</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CUSTOMER.map((m) => (
          <Card key={m.path} m={m} />
        ))}
      </div>
    </div>
  );
}
