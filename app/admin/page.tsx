import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getAllClients, getApprovalQueue } from "@/app/_lib/sheets";
import { PLAN_LABELS } from "@/app/_lib/types";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");

// Best-effort: the real "承認待ち" tab headers/status vocabulary aren't
// confirmed from code (see recon notes), so "pending" is inferred loosely —
// falls back to counting every row in the tab if nothing matches a known
// "still pending" marker.
const DONE_MARKERS = ["済", "完了", "approved", "done", "posted", "投稿済"];
function isPending(status: string): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  return !DONE_MARKERS.some((m) => s.includes(m.toLowerCase()));
}

export default async function AdminDashboard() {
  await checkAuth();

  let clients: Awaited<ReturnType<typeof getAllClients>> = [];
  let approvals: Awaited<ReturnType<typeof getApprovalQueue>> = [];
  let error = "";
  try {
    [clients, approvals] = await Promise.all([
      getAllClients(),
      getApprovalQueue(),
    ]);
  } catch (e) {
    error = String(e);
  }

  const totalUsed = clients.reduce((s, c) => s + c.used_this_month, 0);

  const planCounts: Record<string, number> = {};
  for (const c of clients) {
    planCounts[c.plan] = (planCounts[c.plan] || 0) + 1;
  }

  const pendingApprovals = approvals.filter((a) => isPending(a.status));

  const recent = [...approvals].reverse().slice(0, 10);

  const costStd = Number(process.env.COST_PER_VIDEO_STD);
  const costPremium = Number(process.env.COST_PER_VIDEO_PREMIUM);
  const showCost =
    !Number.isNaN(costStd) &&
    process.env.COST_PER_VIDEO_STD !== undefined &&
    !Number.isNaN(costPremium) &&
    process.env.COST_PER_VIDEO_PREMIUM !== undefined;

  let estimatedCost = 0;
  if (showCost) {
    for (const c of clients) {
      const unit = c.plan === "premium" ? costPremium : costStd;
      estimatedCost += c.used_this_month * unit;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--brand-ink)]">
          ダッシュボード
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/admin/materials"
            className="font-bold text-[var(--brand-orange-dark)] hover:text-[var(--brand-orange)] transition-colors"
          >
            営業資料棚 →
          </a>
          <a
            href="/admin/clients"
            className="text-gray-500 hover:text-[var(--brand-orange)] transition-colors"
          >
            顧客一覧 →
          </a>
        </div>
      </div>

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

      {/* KPIカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
          <div className="text-xs text-gray-400">今月の生成本数</div>
          <div className="text-2xl font-bold text-[var(--brand-ink)] mt-1">
            {totalUsed}
            <span className="text-sm font-medium text-gray-400 ml-1">本</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
          <div className="text-xs text-gray-400">顧客数</div>
          <div className="text-2xl font-bold text-[var(--brand-ink)] mt-1">
            {clients.length}
            <span className="text-sm font-medium text-gray-400 ml-1">社</span>
          </div>
          {clients.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-gray-400">
              {Object.entries(planCounts).map(([plan, n]) => (
                <span key={plan}>
                  {PLAN_LABELS[plan] || plan} {n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
          <div className="text-xs text-gray-400">承認待ち</div>
          <div className="text-2xl font-bold text-[var(--brand-ink)] mt-1">
            {pendingApprovals.length}
            <span className="text-sm font-medium text-gray-400 ml-1">件</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
          <div className="text-xs text-gray-400">概算コスト(今月)</div>
          {showCost ? (
            <div className="text-2xl font-bold text-[var(--brand-ink)] mt-1">
              {yen(estimatedCost)}
            </div>
          ) : (
            <div className="text-sm text-gray-300 mt-2">
              COST_PER_VIDEO_* 未設定
            </div>
          )}
        </div>
      </div>

      {/* 直近の生成履歴 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            直近の生成履歴(最大10件)
          </h2>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            承認待ちタブにデータがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    顧客
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    物件名
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    ステータス
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    作成日時
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a, i) => (
                  <tr
                    key={`${a.approval_id || i}-${i}`}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--brand-ink)]">
                      {a.client_name || a.client_id || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.property_name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          isPending(a.status)
                            ? "bg-amber-50 text-amber-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {a.status || "不明"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.created_at || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
