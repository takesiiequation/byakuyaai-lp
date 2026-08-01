import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getClientById } from "@/app/_lib/sheets";
import {
  PLAN_LABELS,
  PLAN_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/app/_lib/types";
import ClientEditor from "../../_components/ClientEditor";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

function maskSecret(s: string): string {
  if (!s) return "(未設定)";
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAuth();
  const { id } = await params;

  const client = await getClientById(id);
  if (!client) notFound();

  const planClass = PLAN_COLORS[client.plan] || "bg-gray-100 text-gray-700";
  const statusClass =
    STATUS_COLORS[client.status] || "bg-gray-100 text-gray-500";
  const pct =
    client.monthly_quota > 0
      ? Math.round((client.used_this_month / client.monthly_quota) * 100)
      : 0;

  const sections = [
    {
      title: "基本情報",
      fields: [
        { key: "client_name", label: "顧客名" },
        {
          key: "plan",
          label: "プラン",
          type: "select",
          options: Object.entries(PLAN_LABELS).map(([v, l]) => ({
            value: v,
            label: l,
          })),
        },
        {
          key: "tone",
          label: "トーン",
          type: "select",
          options: [
            { value: "casual", label: "カジュアル" },
            { value: "polite", label: "丁寧" },
          ],
        },
        { key: "monthly_quota", label: "月間クォータ", type: "number" },
        {
          key: "status",
          label: "ステータス",
          type: "select",
          options: Object.entries(STATUS_LABELS).map(([v, l]) => ({
            value: v,
            label: l,
          })),
        },
      ],
    },
    {
      title: "承認・通知",
      fields: [
        {
          key: "require_approval",
          label: "投稿前承認",
          type: "select",
          options: [
            { value: "", label: "不要" },
            { value: "true", label: "必要" },
          ],
        },
        { key: "approval_email", label: "承認通知先メール" },
        { key: "notify_email", label: "通知先メール" },
        {
          key: "report_enabled",
          label: "月次レポート配信",
          type: "select",
          options: [
            { value: "", label: "配信しない" },
            { value: "true", label: "配信する" },
          ],
        },
      ],
    },
    {
      title: "SNS連携",
      fields: [
        { key: "publer_ig_account_id", label: "Publer Instagram アカウントID" },
        { key: "publer_tt_account_id", label: "Publer TikTok アカウントID" },
      ],
    },
    {
      title: "LINE AI",
      fields: [
        {
          key: "line_channel_token",
          label: "チャネルアクセストークン",
          sensitive: true,
        },
        {
          key: "line_channel_secret",
          label: "チャネルシークレット",
          sensitive: true,
        },
        { key: "line_bot_user_id", label: "ボットユーザーID" },
      ],
    },
    {
      title: "計測リンク・Drive連携",
      fields: [
        {
          key: "drive_folder_id",
          label: "顧客フォルダ",
          type: "drive_folder",
        },
        { key: "link_hp_url", label: "HP計測リンク先URL" },
        { key: "link_line_url", label: "LINE計測リンク先URL(lin.ee等)" },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <a
          href="/admin/clients"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)] active:scale-95 transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)] truncate">
              {client.client_name || client.client_id}
            </h1>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${planClass}`}
            >
              {PLAN_LABELS[client.plan] || client.plan}
            </span>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${statusClass}`}
            >
              {STATUS_LABELS[client.status] || client.status || "不明"}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{client.client_id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* 認証情報(表示のみ) */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              認証情報(表示のみ・編集不可)
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">クライアントID</div>
              <div className="font-mono text-sm text-[var(--brand-ink)]">
                {client.client_id}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">シークレットキー</div>
              <div className="font-mono text-sm text-[var(--brand-ink)]">
                {maskSecret(client.secret_key)}
              </div>
            </div>
          </div>
        </div>

        {/* システム管理(自動更新・読み取り専用) */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              システム管理(自動更新・読み取り専用)
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>今月の使用量</span>
                <span className="font-medium tabular-nums">
                  {client.used_this_month}
                  <span className="text-gray-400"> / {client.monthly_quota}</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all"
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-400 mb-1">次回リセット日</div>
                <div className="text-[var(--brand-ink)]">
                  {client.quota_reset || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">次回投稿予定</div>
                <div className="text-[var(--brand-ink)]">
                  {client.next_post_slot || "-"}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 pt-1">
              ※ この項目は動画生成パイプライン(n8n)が自動で更新します。ここから編集はできません。
            </p>
          </div>
        </div>
      </div>

      <ClientEditor client={client} sections={sections} />
    </div>
  );
}
