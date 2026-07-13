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
import CollapsedHistory from "./_components/CollapsedHistory";

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
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
        </div>
        <div className="text-xs text-[var(--brand-gray-light)] mt-1">
          {formatDate(row.created_at)}
        </div>
      </div>
      <div className="shrink-0">
        {status === "pending_approval" && row.approval_id ? (
          <a
            href={`/revise/${row.approval_id}`}
            className="inline-block bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm hover:shadow-lg transition-all active:scale-[0.98]"
          >
            確認・修正する
          </a>
        ) : status === "posted" ? (
          // Deliberately no video URL/link here — video_url_raw expires in
          // ~3 days and permanent hosting isn't built yet (design §7.3 /
          // P1.2). A dead link would look broken within days; the badge
          // alone stays true forever.
          <span className="text-xs text-[var(--brand-gray-light)]">
            投稿完了
          </span>
        ) : null}
      </div>
    </div>
  );
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
    return (
      <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold bg-red-50 text-red-600 border-red-200">
        今月の上限に達しました(翌月1日リセット)
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
      {slots.length === 0 ? (
        <div className="p-8 text-center text-[var(--brand-gray-light)] text-sm">
          今月の投稿はまだありません
        </div>
      ) : (
        <>
          {/* デスクトップ/タブレット: 月グリッド */}
          <div className="hidden sm:block p-4">
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
          </div>

          {/* スマホ: リスト表示 */}
          <div className="sm:hidden divide-y divide-gray-50">
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
        </>
      )}
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

  const [rows, monthlySlots] = await Promise.all([
    getProductionRows(clientId),
    getMonthlyApprovedSlots(clientId),
  ]);
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
          <a
            href="/portal/submit"
            className="inline-block bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm hover:shadow-lg transition-all active:scale-[0.98]"
          >
            + 新しい動画を作る
          </a>
          <LogoutButton />
        </div>
      </div>

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

      <PostCalendar slots={monthlySlots} year={currentYear} month={currentMonth} />
    </Shell>
  );
}
