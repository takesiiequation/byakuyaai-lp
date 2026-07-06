import type { Metadata } from "next";
import Image from "next/image";
import { getReviseInfo } from "@/app/_lib/revise";
import ReviseForm from "../_components/ReviseForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "動画テロップの修正",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)]">
      <header className="sticky top-0 z-30 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4 sm:px-6">
          <Image
            src="/logo.png"
            alt="ByakuyaAI"
            width={120}
            height={36}
            className="h-7 w-auto"
          />
        </div>
      </header>
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </div>
      <p className="pb-8 text-center text-xs text-[var(--brand-gray-light)]">
        © 2026 ByakuyaAI. All rights reserved.
      </p>
    </main>
  );
}

function MessageCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
      <h1 className="text-lg font-black text-[var(--brand-ink)] sm:text-xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)]">
        {body}
      </p>
    </div>
  );
}

export default async function RevisePage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const info = await getReviseInfo(approvalId);

  if (!info.ok) {
    return (
      <Shell>
        <MessageCard
          title="ページを表示できませんでした"
          body="お手数ですがご担当までご連絡ください。"
        />
      </Shell>
    );
  }

  if (!info.editable) {
    return (
      <Shell>
        <MessageCard
          title="この動画は編集できません"
          body="この動画は現在編集できません(投稿処理中または投稿済み)。"
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <ReviseForm
        approvalId={approvalId}
        propertyName={info.property_name ?? ""}
        clientName={info.client_name ?? ""}
        videoUrl={info.video_url ?? ""}
        telops={info.telops ?? []}
        caption={info.caption ?? ""}
      />
    </Shell>
  );
}
