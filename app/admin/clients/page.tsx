import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getAllClients } from "@/app/_lib/sheets";
import {
  PLAN_LABELS,
  PLAN_COLORS,
  TONE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/app/_lib/types";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

export default async function ClientsListPage() {
  await checkAuth();

  let clients: Awaited<ReturnType<typeof getAllClients>> = [];
  let error = "";
  try {
    clients = await getAllClients();
  } catch (e) {
    error = String(e);
    clients = [];
  }

  const totalQuota = clients.reduce((s, c) => s + c.monthly_quota, 0);
  const totalUsed = clients.reduce((s, c) => s + c.used_this_month, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--brand-ink)]">
          顧客管理
        </h1>
        <a
          href="/admin/clients/new"
          className="hidden sm:inline-flex items-center gap-1.5 bg-[var(--brand-orange)] text-white font-medium rounded-xl px-4 py-2 text-sm hover:bg-[var(--brand-orange-dark)] active:scale-[0.98] transition-all"
        >
          + 新規顧客
        </a>
      </div>

      {clients.length > 0 && (
        <div className="flex items-center gap-3 mb-5 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            {clients.length} 社
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
            {totalUsed} / {totalQuota} 本
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          <p className="font-bold mb-1">接続エラー</p>
          <p className="break-all">{error}</p>
          <p className="mt-2 text-red-500 text-xs">
            GOOGLE_SERVICE_ACCOUNT_KEY と GOOGLE_SHEET_ID が Vercel
            に設定されているか確認してください。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {clients.map((c) => {
          const pct =
            c.monthly_quota > 0
              ? Math.round((c.used_this_month / c.monthly_quota) * 100)
              : 0;
          const planClass = PLAN_COLORS[c.plan] || "bg-gray-100 text-gray-700";
          const statusClass =
            STATUS_COLORS[c.status] || "bg-gray-100 text-gray-500";
          const barColor =
            pct >= 90
              ? "#ef4444"
              : pct >= 70
                ? "#f59e0b"
                : "var(--brand-orange)";

          return (
            <a
              key={c.client_id}
              href={`/admin/clients/${c.client_id}`}
              className="group bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-[15px] sm:text-base truncate text-[var(--brand-ink)] group-hover:text-[var(--brand-orange)] transition-colors">
                    {c.client_name || c.client_id}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {c.client_id}
                    {c.tone && ` · ${TONE_LABELS[c.tone] || c.tone}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${planClass}`}
                  >
                    {PLAN_LABELS[c.plan] || c.plan}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass}`}
                  >
                    {STATUS_LABELS[c.status] || c.status || "不明"}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>今月の使用量</span>
                  <span className="font-medium tabular-nums">
                    {c.used_this_month}
                    <span className="text-gray-400"> / {c.monthly_quota}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {c.line_bot_user_id && (
                  <span className="text-[10px] font-medium bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full">
                    LINE AI
                  </span>
                )}
                {c.require_approval === "true" && (
                  <span className="text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                    承認制
                  </span>
                )}
                {c.next_post_slot && (
                  <span className="text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                    次回 {c.next_post_slot.slice(0, 10)}
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <span className="text-xs text-gray-400 group-hover:text-[var(--brand-orange)] transition-colors">
                  詳細 →
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {clients.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-500 mb-1">
            顧客がまだ登録されていません
          </p>
          <p className="text-sm text-gray-400 mb-4">
            最初の顧客を追加しましょう
          </p>
          <a
            href="/admin/clients/new"
            className="inline-flex items-center gap-1.5 bg-[var(--brand-orange)] text-white font-medium rounded-xl px-5 py-2.5 text-sm hover:bg-[var(--brand-orange-dark)] active:scale-[0.98] transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m6-6H6"
              />
            </svg>
            新規顧客を追加
          </a>
        </div>
      )}

      <a
        href="/admin/clients/new"
        className="sm:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-[var(--brand-orange)] text-white flex items-center justify-center shadow-lg shadow-[var(--brand-orange)]/30 active:scale-95 transition-all"
        aria-label="新規顧客を追加"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
        </svg>
      </a>
    </div>
  );
}
