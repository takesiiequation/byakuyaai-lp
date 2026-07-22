import Image from "next/image";
import Link from "next/link";

// Visual twin of app/revise/[approvalId]/page.tsx's (unexported, page-local)
// Shell — duplicated rather than imported so the customer-facing revise flow
// (delicate, recently TOCTOU-patched — see MEMORY.md) stays untouched by
// portal work. Keep both in sync by eye if the brand shell changes.
export function Shell({
  children,
  wide,
  maxWidthClassName,
}: {
  children: React.ReactNode;
  wide?: boolean;
  /** v3.2(2026-07-22・PCレイアウト対応・design.md「v3.2仕様」): 生の
   * Tailwindクラスで最大幅を上書きする。既存の `wide`(ダッシュボード用・
   * lg:max-w-[1700px])はそのまま残す — 変えるとダッシュボードの見た目が
   * 変わってしまうため。/portal/submit・/portal/guide だけを個別に広げ
   * たい場合はこちらでpropを渡す(Shellを一律変更せず対象ページだけ広げる
   * 方針)。指定時はwideより優先。 */
  maxWidthClassName?: string;
}) {
  const maxWidth =
    maxWidthClassName ?? (wide ? "max-w-lg lg:max-w-[1700px]" : "max-w-lg");
  const isWidened = wide || !!maxWidthClassName;
  const padX = isWidened ? "px-4 sm:px-6 lg:px-8" : "px-4 sm:px-6";
  return (
    <main className="min-h-screen bg-[var(--brand-cream)]">
      <header className="sticky top-0 z-30 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
        <div className="flex h-14 items-center px-4 sm:px-6">
          {/* 2026-07-15 岡本要望: ロゴクリックでマイページへ戻れるように */}
          <Link href="/portal" aria-label="マイページへ戻る">
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={120}
              height={36}
              className="h-7 w-auto"
            />
          </Link>
        </div>
      </header>
      <div className={`mx-auto py-6 sm:py-10 ${padX} ${maxWidth}`}>
        {children}
      </div>
      <p className="pb-8 text-center text-xs text-[var(--brand-gray-light)]">
        © 2026 ByakuyaAI. All rights reserved.
      </p>
    </main>
  );
}

export function MessageCard({ title, body }: { title: string; body: string }) {
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
