import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getClientById } from "@/app/_lib/sheets";
import { PLAN_LABELS } from "@/app/_lib/types";
import ClientEditor from "../../_components/ClientEditor";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
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

  const sections = [
    {
      title: "基本情報",
      fields: [
        { key: "company_name", label: "会社名" },
        { key: "plan", label: "プラン", type: "select", options: Object.entries(PLAN_LABELS).map(([v, l]) => ({ value: v, label: l })) },
        { key: "monthly_quota", label: "月間クォータ", type: "number" },
        { key: "used_this_month", label: "今月使用数", type: "number" },
        { key: "quota_reset", label: "次回リセット日" },
        { key: "next_post_slot", label: "次回投稿予定" },
      ],
    },
    {
      title: "動画・SNS設定",
      fields: [
        { key: "video_mode", label: "動画モード" },
        { key: "bgm_url", label: "BGM URL" },
        { key: "cover_image_url", label: "カバー画像 URL" },
        { key: "font_family", label: "フォント" },
        { key: "accent_color", label: "アクセントカラー" },
      ],
    },
    {
      title: "承認・通知",
      fields: [
        { key: "require_approval", label: "投稿前承認", type: "select", options: [{ value: "", label: "不要" }, { value: "true", label: "必要" }] },
        { key: "approval_email", label: "承認通知先メール" },
      ],
    },
    {
      title: "LINE AI",
      fields: [
        { key: "line_channel_token", label: "チャネルアクセストークン", sensitive: true },
        { key: "line_channel_secret", label: "チャネルシークレット", sensitive: true },
        { key: "line_bot_user_id", label: "ボットユーザーID" },
      ],
    },
    {
      title: "認証",
      fields: [
        { key: "secret_key", label: "シークレットキー", sensitive: true },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </a>
        <h1 className="text-2xl font-bold">
          {client.company_name || client.client_id}
        </h1>
        <span className="text-sm text-gray-400">{client.client_id}</span>
      </div>
      <ClientEditor client={client} sections={sections} />
    </div>
  );
}
