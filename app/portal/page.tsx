import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/app/_lib/portalAuth";
import { getClientById, getMonthlyApprovedSlots, type PostSlot } from "@/app/_lib/sheets";
import type { Client } from "@/app/_lib/types";
import { quotaSummary } from "@/app/_lib/quota";
import { jstNow } from "@/app/_lib/jst";
import {
  getProductionRows,
  resolveStatus,
  isTerminalStatus,
  PORTAL_STATUS_LABELS,
  PORTAL_STATUS_COLORS,
  type ProductionRow,
} from "@/app/_lib/portal";
import { Shell, MessageCard } from "./_components/Shell";
import LogoutButton from "./_components/LogoutButton";
import ApprovalActions from "./_components/ApprovalActions";
import CollapsedHistory from "./_components/CollapsedHistory";
import HideRowButton from "./_components/HideRowButton";
import SoldButton from "./_components/SoldButton";
import { MonthlyReportSection } from "./_components/MonthlyReport";
import { getLatestReport } from "@/app/_lib/report";

// Terminal rows (投稿済み/却下) beyond this count collapse behind the
// "過去の動画をすべて表示" toggle — active rows (制作中/承認待ち) are never
// subject to this cap, see the split below.
const VISIBLE_TERMINAL_COUNT = 5;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "マイページ",
  robots: { index: false, follow: false },
};

/** Cookie presence/signature check only — does NOT imply the client is still
 * portal_enabled (that's re-verified below, every request, straight from
 * the sheet — §0 "read-time recompute" principle: a session issued while
 * enabled must not keep working after an admin flips it off). */
async function getSessionClientId(): Promise<string | null> {
  const jar = await cookies();
  const session = jar.get("portal-session")?.value;
  if (!session) return null;
  const result = verifyPortalSession(session);
  return result.ok ? result.clientId : null;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // 2026-08-07 岡本: 時刻は顧客にとって意味が無く、日付だけで十分
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function StatusRow({ row }: { row: ProductionRow }) {
  const status = resolveStatus(row);
  const label = row.property_name || "(物件名未確定)";
  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-[var(--brand-ink)] truncate">
            {label}
          </span>
          <span
            className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border ${PORTAL_STATUS_COLORS[status]}`}
          >
            {PORTAL_STATUS_LABELS[status]}
          </span>
          {/* 失敗系の行だけ「×(非表示)」を出す(2026-07-27岡本発案)。
              exec_id が空の行(古いデータ等)は対象を特定できないため出さない。 */}
          {(status === "failed" || status === "revise_failed") &&
            row.exec_id && <HideRowButton execId={row.exec_id} />}
        </div>
        <div className="text-xs text-[var(--brand-gray-light)] mt-1">
          {formatDate(row.created_at)}
        </div>
      </div>
      <div className="shrink-0">
        {status === "pending_approval" && row.approval_id ? (
          // 2026-07-17 岡本要望: 承認メールのボタンからしか承認/却下できず
          // ポータルには「確認・修正する」しかなかった盲点を埋める。
          // ApprovalActions が承認/却下/確認・修正するの3つをまとめて描画する
          // (実体は承認メールの<form>と同一の n8n webhook — app/_lib/
          // approvalAction.ts参照)。
          <ApprovalActions
            approvalId={row.approval_id}
            propertyName={row.property_name}
          />
        ) : status === "posted" || status === "delivered" ? (
          // Deliberately no video URL/link here — video_url_raw expires in
          // ~3 days and permanent hosting isn't built yet (design §7.3 /
          // P1.2). A dead link would look broken within days; the badge
          // alone stays true forever.
          // 成約報告(2026-08-01): 投稿済み/納品済み行から顧客自身が成約を
          // 報告できる。LINEお問い合わせAIが「成約済み」案内で予約を弾く。
          row.exec_id ? (
            <SoldButton execId={row.exec_id} />
          ) : (
            <span className="text-xs text-[var(--brand-gray-light)]">
              投稿完了
            </span>
          )
        ) : status === "sold" ? (
          <span className="text-xs text-[var(--brand-gray-light)]">
            お問い合わせに成約済みとご案内します
          </span>
        ) : status === "revising" ? (
          // 2026-07-15 岡本要望: 修正依頼を送った案件は「確認・修正する」
          // ボタンをもう出さない(まだ承認待ちに見えて再クリックされる事故
          // 防止)。バッジは PORTAL_STATUS_LABELS 側で「✏️ 修正中」表示済み。
          <span className="text-xs text-[var(--brand-gray-light)]">
            数分で完了します
          </span>
        ) : status === "failed" ? (
          // 障害ステータス可視化(status_visibility_package_draft.md §3.2)。
          // バッジは PORTAL_STATUS_LABELS 側で「⚠️ 生成に失敗しました」表示
          // 済みなのでここでは重複させず、補足文言+再依頼導線のみ。
          <div className="text-right">
            <p className="mb-1.5 max-w-[220px] text-xs font-semibold text-red-600 sm:max-w-none">
              お手数ですが、もう一度ご依頼ください
            </p>
            <a
              href="/portal/submit"
              className="inline-block rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-4 py-2 text-xs font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] sm:text-sm"
            >
              もう一度依頼する
            </a>
          </div>
        ) : status === "revise_failed" ? (
          // 修正ページの導線は既存の「確認・修正する」ボタンと同じ
          // /revise/{approval_id} を再利用(revision_count は失敗時に加算
          // されないため、再送信で1回までの権利は正当に消費できる)。
          <div className="text-right">
            <p className="mb-1.5 max-w-[220px] text-xs font-semibold text-red-600 sm:max-w-none">
              もう一度修正内容をお送りください
            </p>
            {row.approval_id && (
              <a
                href={`/revise/${row.approval_id}`}
                className="inline-block rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-4 py-2 text-xs font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] sm:text-sm"
              >
                修正ページを開く
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// quota_reset("YYYY-MM-DD" — quota.ts の effectiveUsed と同じ文字列形)を
// 「M月D日」表示に整形する。ほとんどの顧客は翌月1日だが、任意日を手入力
// された顧客でも実値を出す。空/不正なら "" を返し、呼び出し側で丸ごと
// 省略する(fail-soft・new Date() は使わずレンジ検証のみで足りる)。
function formatQuotaResetLabel(quotaReset: string): string {
  const m = (quotaReset || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return "";
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${month}月${day}日`;
}

// 「今月の制作可能本数」バッジ — レシピは quota.ts に一本化(/portal/submit
// のゲートと同一の effectiveUsed を使う。表示専用でここでは判定しない)。
function QuotaBadge({ client }: { client: Client }) {
  const { quota, remaining } = quotaSummary(client);

  if (quota <= 0) {
    return (
      <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-gray-100 text-gray-400 border-gray-200">
        今月の制作可能本数: 未設定
      </span>
    );
  }

  if (remaining <= 0) {
    const resetLabel = formatQuotaResetLabel(client.quota_reset);
    return (
      <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-red-50 text-red-600 border-red-200">
        今月の上限に達しました{resetLabel ? `(${resetLabel}リセット)` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-200">
      今月の制作可能本数: 残り{remaining}本 / {quota}本
    </span>
  );
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const timeLabel = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

// プランに応じた「未開放機能」の案内カード — 既存の白カードと同じ骨格
// (角丸+リング+shadow)だが、半透明+グレーアウトで「存在するが眠っている」
// 見た目にする(2026-07-15、岡本要望: trialは自動投稿もレポートも不可・
// standardはレポートのみ不可、と伝わるように)。プラン判定はしない — 呼び出し
// 側(PortalPage)が渡す真偽値に従って描画するだけの表示専用コンポーネント。
function FeatureLockCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/60 shadow-sm ring-1 ring-black/5">
      <div className="border-b border-gray-100/80 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold text-gray-400">{title}</h2>
      </div>
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center sm:px-8">
        <span aria-hidden className="text-2xl opacity-60 grayscale">
          🔒
        </span>
        <p className="text-xs font-semibold text-gray-400">
          この機能はプレミアムプランでアンロックされます
        </p>
        <p className="max-w-xs text-[11px] leading-relaxed text-gray-400/80">
          {description}
        </p>
      </div>
    </div>
  );
}

// 「今月の投稿予定・実績」— 承認待ちタブの status==='approved' 行(=Publer
// への投稿が実際に成功した分)を my_post_slot で月グリッドにプロットする。
// slots は getMonthlyApprovedSlots が渡す sanitized な {property_name, day,
// hour, minute} のみ(post_data 等は一切含まれない・sheets.ts のコメント参照)。
// sm未満はリスト表示に切り替え(同じ slots を使い回すだけ・データ取得は1回)。
function PostCalendar({
  slots,
  year,
  month,
}: {
  slots: PostSlot[];
  year: number;
  month: number;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const byDay = new Map<number, PostSlot[]>();
  for (const s of slots) {
    const list = byDay.get(s.day) ?? [];
    list.push(s);
    byDay.set(s.day, list);
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-bold text-[var(--brand-ink)]">
          {year}年{month}月の投稿予定・実績
        </h2>
      </div>
      {/* デスクトップ/タブレット: 月グリッド — データが0件でも枠だけの寂しい表示に
          しない。日〜土7列×その月の1〜末日セルは常に描画し(既存の cells/byDay
          プロットロジックをそのまま流用)、0件の時だけ薄い案内文を重ねる。 */}
      <div className="hidden sm:block p-4 relative">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--brand-gray-light)] mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`min-h-[64px] rounded-lg p-1.5 text-left ${
                day ? "bg-[var(--brand-cream)]" : ""
              }`}
            >
              {day && (
                <>
                  <div className="text-[11px] font-semibold text-[var(--brand-gray-light)]">
                    {day}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {(byDay.get(day) ?? []).map((s, si) => (
                      <div
                        key={si}
                        title={`${timeLabel(s.hour, s.minute)} ${
                          s.property_name || "(物件名未確定)"
                        }`}
                        className="truncate rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-1 py-0.5"
                      >
                        {timeLabel(s.hour, s.minute)}{" "}
                        {s.property_name || "(物件名未確定)"}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {slots.length === 0 && (
          <p className="mt-3 text-center text-xs text-[var(--brand-gray-light)]">
            ここに投稿予定が入ります
          </p>
        )}
      </div>

      {/* スマホ: リスト表示(データ0件時は従来通りテキストのみ) */}
      <div className="sm:hidden">
        {slots.length === 0 ? (
          <div className="p-8 text-center text-[var(--brand-gray-light)] text-sm">
            今月の投稿はまだありません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {slots.map((s, i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <div className="shrink-0 text-xs font-semibold text-[var(--brand-gray-light)] w-20">
                  {month}/{s.day} {timeLabel(s.hour, s.minute)}
                </div>
                <div className="flex-1 min-w-0 text-sm text-[var(--brand-ink)] truncate">
                  {s.property_name || "(物件名未確定)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/portal/login");

  // /portal/submit からの実送信成功リダイレクト(?submitted=1)でバナー表示。
  // n8n webhook は onReceived 応答のため「受付」までしか保証できない —
  // 文言もそこまでに留める(仕様書・罠(4)-3)。
  const sp = searchParams ? await searchParams : {};
  const justSubmitted = sp.submitted === "1";

  const client = await getClientById(clientId);
  // Re-verify portal_enabled straight from the sheet on every request
  // (not just at login) — see getSessionClientId's comment.
  if (!client || client.portal_enabled !== "true") {
    return (
      <Shell>
        <MessageCard
          title="マイページをご利用いただけません"
          body="お手数ですが担当者までご連絡ください。"
        />
      </Shell>
    );
  }

  // 月次レポートのWeb表示はプレミアム特典（+ test=検証枠）限定 — 対象外プランでは
  // Sheets 読み取り自体を発生させない(無駄なAPI呼び出し・セクションも非表示)。
  // ※メール配信側(n8n月次レポートWF Filter Clients)も premium/test に絞り済みで一致。
  const isPremium = client.plan === "premium" || client.plan === "test";

  // 未開放機能のロック表示ルール(2026-07-15、岡本要望)。premium/test は
  // isPremium===true の一点で常にどちらも false — 既存の見え方を1pxも変えない
  // ことをこの1行の否定で担保する。
  //   ・trial: 自動投稿もレポートも不可(メール納品のみ)→ 両方ロック
  //   ・standard(active): レポートのみ不可 → レポートだけロック
  //   ・premium / test: 現状のまま(ロック表示なし)
  const isTrial = client.status === "trial";
  const lockAutopost = !isPremium && isTrial;
  const lockReport = !isPremium && (isTrial || client.plan === "standard");

  const [allRows, monthlySlots, reportRow] = await Promise.all([
    getProductionRows(clientId),
    getMonthlyApprovedSlots(clientId),
    isPremium ? getLatestReport(clientId) : Promise.resolve(null),
  ]);
  // hidden==='true' の行(HideRowButton経由で顧客自身が消した失敗行)は
  // 一覧そのものから除外する — データはシート上に残る(監査可能)ので
  // 除外はこの表示層だけの処理でよい。
  // 比較は大文字小文字を吸収(手作業でシートにTRUEと入れられても効くように)。
  const rows = allRows.filter((r) => r.hidden.toLowerCase() !== "true");
  const { year: currentYear, month: currentMonth } = jstNow();

  // Active rows (制作中/承認待ち — anything the client might still need to
  // act on, "unknown" included defensively) always render. Terminal rows
  // (投稿済み/却下) beyond the 5 most recent collapse behind a toggle so a
  // long-running client's page doesn't keep growing — see CollapsedHistory.
  // `rows` is already newest-first (getProductionRows), and this single
  // pass preserves that order in both the visible and hidden lists.
  const visibleRows: ProductionRow[] = [];
  const hiddenRows: ProductionRow[] = [];
  let terminalSeen = 0;
  for (const row of rows) {
    if (isTerminalStatus(resolveStatus(row))) {
      if (terminalSeen < VISIBLE_TERMINAL_COUNT) {
        visibleRows.push(row);
        terminalSeen += 1;
      } else {
        hiddenRows.push(row);
      }
    } else {
      visibleRows.push(row);
    }
  }

  return (
    <Shell wide>
      {justSubmitted && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3">
          動画の作成依頼を受け付けました。一覧への反映まで数分かかることがあります。
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
            {client.client_name || clientId} 様
          </h1>
          <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
            制作状況一覧
          </p>
          <div className="mt-2">
            <QuotaBadge client={client} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton />
        </div>
      </div>

      {/* 主役CTA — 顧客の最頻使用アクション。制作状況一覧より上に単独配置し、
          幅広・大きめパディングで押しやすさを最優先(2026-07-13 B案)。 */}
      <a
        href="/portal/submit"
        className="mb-6 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:shadow-lg active:scale-[0.99] sm:text-lg"
      >
        ＋ 新しい動画を作る
      </a>

      {/* 写真撮影ガイドへの導線 — trial顧客の素材品質(設備ドアップ・引き不足)
          が動画の魅力を下げていた実例を受けた顧客教育コンテンツ(2026-07-16)。
          「+新しい動画を作る」の直下=最上部に置き、目に入りやすくする。 */}
      <a
        href="/portal/guide"
        className="mb-6 flex items-center gap-3 rounded-2xl border-l-4 border-[var(--brand-orange)] bg-white px-5 py-4 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md active:scale-[0.99]"
      >
        <span aria-hidden className="shrink-0 text-2xl">
          📸
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[var(--brand-ink)]">
            魅力的な動画になる写真の撮り方
          </span>
          <span className="mt-0.5 block text-xs text-[var(--brand-gray-light)]">
            1分で読めます
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[var(--brand-orange)]">
          →
        </span>
      </a>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden mb-6">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--brand-gray-light)] text-sm">
            現在制作中の動画はありません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visibleRows.map((row) => (
              <StatusRow key={row.exec_id || `${row.created_at}-${row.property_name}`} row={row} />
            ))}
            <CollapsedHistory count={hiddenRows.length}>
              {hiddenRows.map((row) => (
                <StatusRow key={row.exec_id || `${row.created_at}-${row.property_name}`} row={row} />
              ))}
            </CollapsedHistory>
          </div>
        )}
      </div>

      {lockAutopost ? (
        <FeatureLockCard
          title="自動投稿"
          description="承認後、Instagram / TikTok へ自動投稿されます。現在は動画をメールでお届けしています。"
        />
      ) : (
        <PostCalendar slots={monthlySlots} year={currentYear} month={currentMonth} />
      )}

      {(isPremium || lockReport) && (
        <div className="mt-6">
          {isPremium ? (
            <MonthlyReportSection reportRow={reportRow} />
          ) : (
            <FeatureLockCard
              title="今月のレポート"
              description="投稿の反響を毎月レポートでお届けします。"
            />
          )}
        </div>
      )}

      {/* ご意見・ご要望への導線(2026-07-22 岡本発案・2026-07-23 岡本FB
          「基本的には顧客にとって邪魔な欄」で最下部へ移動+控えめな
          テキストリンクへ縮小。全コンテンツの後・Shellのフッター
          (© 2026 ByakuyaAI...)の直前に置く。 */}
      <div className="mt-10 text-center">
        <a
          href="/portal/feedback"
          className="text-xs text-[var(--brand-gray-light)] underline decoration-[var(--brand-border)] underline-offset-2 transition-colors hover:text-[var(--brand-ink)]"
        >
          📮 ご意見・ご要望はこちら
        </a>
      </div>
    </Shell>
  );
}
