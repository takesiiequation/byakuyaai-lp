import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPortalSession } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
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

export default async function PortalPage() {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/portal/login");

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

  const rows = await getProductionRows(clientId);

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
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
            {client.client_name || clientId} 様
          </h1>
          <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
            制作状況一覧
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
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
    </Shell>
  );
}
