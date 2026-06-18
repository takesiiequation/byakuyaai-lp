import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getAllClients } from "@/app/_lib/sheets";
import { PLAN_LABELS, PLAN_COLORS } from "@/app/_lib/types";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

export default async function AdminDashboard() {
  await checkAuth();

  let clients: Awaited<ReturnType<typeof getAllClients>> = [];
  let error = "";
  try {
    clients = await getAllClients();
  } catch (e) {
    error = String(e);
    clients = [];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <span className="text-sm text-gray-500">
          {clients.length} 社
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          <p className="font-bold mb-1">接続エラー</p>
          <p>{error}</p>
          <p className="mt-2 text-red-500">
            GOOGLE_SERVICE_ACCOUNT_KEY と GOOGLE_SHEET_ID が Vercel に設定されているか確認してください。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => {
          const pct =
            c.monthly_quota > 0
              ? Math.round((c.used_this_month / c.monthly_quota) * 100)
              : 0;
          const planClass = PLAN_COLORS[c.plan] || "bg-gray-100 text-gray-700";

          return (
            <a
              key={c.client_id}
              href={`/admin/clients/${c.client_id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-bold text-base">
                    {c.company_name || c.client_id}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.client_id}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${planClass}`}
                >
                  {PLAN_LABELS[c.plan] || c.plan}
                </span>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>使用量</span>
                  <span>
                    {c.used_this_month} / {c.monthly_quota}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor:
                        pct >= 90
                          ? "#ef4444"
                          : pct >= 70
                            ? "#f59e0b"
                            : "var(--brand-orange)",
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {c.line_bot_user_id && (
                  <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                    LINE AI
                  </span>
                )}
                {c.require_approval === "true" && (
                  <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">
                    承認制
                  </span>
                )}
                {c.next_post_slot && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    次回: {c.next_post_slot.slice(0, 10)}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {clients.length === 0 && !error && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">顧客がまだ登録されていません</p>
          <a
            href="/admin/clients/new"
            className="text-[var(--brand-orange)] hover:underline"
          >
            + 新規顧客を追加
          </a>
        </div>
      )}
    </div>
  );
}
