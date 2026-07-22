import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { Shell, MessageCard } from "../_components/Shell";
import FeedbackForm from "../_components/FeedbackForm";

// /portal/feedback — 岡本発案「ご意見・ご要望」画面。目的は2つ:
// ①不満の早期検知(解約前に拾う) ②好評の声の収集(営業・LP転用の証言資産)。
// 認証+portal_enabled再検証は /portal/submit と同一の流儀
// (getPortalClientId → getClientById → Shell)。

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ご意見・ご要望",
  robots: { index: false, follow: false },
};

export default async function PortalFeedbackPage() {
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const client = await getClientById(clientId);
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

  return (
    <Shell>
      <div className="mb-6">
        <a
          href="/portal"
          className="text-xs text-[var(--brand-gray-light)] hover:text-[var(--brand-ink)] transition-colors"
        >
          ← マイページへ戻る
        </a>
        <h1 className="mt-2 text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
          ご意見・ご要望
        </h1>
        <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
          使い心地や動画の仕上がりについて、気軽にお聞かせください
        </p>
      </div>
      <FeedbackForm />
    </Shell>
  );
}
