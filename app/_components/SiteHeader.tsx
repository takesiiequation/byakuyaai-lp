import Image from "next/image";

/**
 * LPのサイトヘッダー(app/page.tsx の SiteHeader と同一デザイン)。
 * トップページ以外(/blog 配下等)からも使えるよう、アンカーは
 * ルート相対(/#contact)にしている点だけがトップページ内蔵版との違い。
 * トップページ自体の表示・動作に影響を与えないよう、app/page.tsx 側は
 * 変更せずこちらは新規の共有コンポーネントとして追加している。
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={140}
              height={42}
              priority
              className="h-9 w-auto"
            />
          </a>
          <span className="hidden text-sm font-bold text-[var(--brand-ink)] sm:inline-block">
            不動産集客をAIで自動化
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs font-bold tracking-wider text-[var(--brand-gray)] md:inline-block">
            AIは、眠らない。
          </span>
          <a
            href="/#contact"
            className="inline-flex items-center rounded-full bg-[var(--brand-orange)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-orange-dark)] sm:text-sm"
          >
            14日間 無料で試す
            <span className="ml-1">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
