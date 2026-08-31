import type { Metadata } from "next";
import { APPROVAL_ID_RE, getReviseInfo } from "@/app/_lib/revise";
import CompanionChat from "./_components/CompanionChat";

export const metadata: Metadata = {
  title: "AI編集担当とチャット | ByakuyaAI",
  robots: { index: false, follow: false },
};

export default async function CompanionPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  let clientName = "";
  let propertyName = "";
  if (APPROVAL_ID_RE.test(approvalId)) {
    try {
      const info = await getReviseInfo(approvalId);
      if (info.ok) {
        clientName = info.client_name ?? "";
        propertyName = info.property_name ?? "";
      }
    } catch {
      /* ヘッダ表示だけの情報なのでfail-soft */
    }
  }
  return (
    <main className="min-h-dvh bg-[#f5f3ef]">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-3 py-4 sm:px-4">
        <CompanionChat
          approvalId={approvalId}
          clientName={clientName}
          propertyName={propertyName}
        />
      </div>
    </main>
  );
}
