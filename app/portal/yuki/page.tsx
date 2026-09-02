// ユキのデスク(2026-09-02) — 会社スコープのAI担当と働く場所
// 設計: fudosan-video/docs/yuki_desk_ui_design.md
// 既存の /companion/[approvalId](動画1本のチャット)とは器が違う:
//   あちら = approval_id で認証・動画1本 / こちら = portal-session で認証・会社
// ゲートは毎リクエストでシートから読み直す(§0 read-time recompute。adminがOFFにした瞬間に効く)
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClientById } from "@/app/_lib/sheets";
import { verifyPortalSession } from "@/app/_lib/portalAuth";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { Shell, MessageCard } from "../_components/Shell";
import YukiDesk from "./_components/YukiDesk";
import DeskLocked from "./_components/DeskLocked";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ユキのデスク",
  robots: { index: false, follow: false },
};

async function getSessionClientId(): Promise<string | null> {
  const jar = await cookies();
  const session = jar.get("portal-session")?.value;
  if (!session) return null;
  const result = verifyPortalSession(session);
  return result.ok ? result.clientId : null;
}

export default async function YukiDeskPage() {
  const clientId = await getSessionClientId();
  if (!clientId) redirect("/portal/login");

  const client = await getClientById(clientId);
  if (!client || !isFlagOn(client.portal_enabled)) {
    return (
      <Shell>
        <MessageCard
          title="マイページをご利用いただけません"
          body="お手数ですが担当者までご連絡ください。"
        />
      </Shell>
    );
  }

  // プレミアム限定機能。フラグ一本で判定する(プラン直参照だと個社の試験開放ができない)
  if (!isFlagOn(client.workspace_enabled)) {
    return (
      <Shell>
        <DeskLocked clientName={client.client_name} />
      </Shell>
    );
  }

  return (
    // PCでは1024pxまで広げ、ユキの長文が「文章として流れる」幅にする(スマホは従来幅)
    <Shell maxWidthClassName="max-w-lg lg:max-w-5xl">
      <YukiDesk clientName={client.client_name} />
    </Shell>
  );
}
