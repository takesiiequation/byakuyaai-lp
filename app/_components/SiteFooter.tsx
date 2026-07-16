import Image from "next/image";

/**
 * LPのサイトフッター(app/page.tsx の SiteFooter と同一デザイン)。
 * トップページ以外(/blog 配下等)からも使えるよう、アンカーは
 * ルート相対(/#flow 等)にしている点だけがトップページ内蔵版との違い。
 * トップページ自体の表示・動作に影響を与えないよう、app/page.tsx 側は
 * 変更せずこちらは新規の共有コンポーネントとして追加している。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--brand-border)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={140}
              height={42}
              className="h-10 w-auto"
            />
            <p className="mt-4 text-sm font-bold text-[var(--brand-ink)]">
              AIは、眠らない。
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--brand-gray)]">
              不動産集客を AI で自動化する SaaS プロダクト。
              <br />
              賃貸・売買どちらの物件にも対応。
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-xs font-bold tracking-widest text-[var(--brand-gray-light)]">
              サービス
            </h4>
            <ul className="space-y-2 text-sm text-[var(--brand-gray)]">
              <li>
                <a href="/#flow" className="hover:text-[var(--brand-orange)]">
                  導入の流れ
                </a>
              </li>
              <li>
                <a href="/#pricing" className="hover:text-[var(--brand-orange)]">
                  料金プラン
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-[var(--brand-orange)]">
                  よくある質問
                </a>
              </li>
              <li>
                <a href="/blog" className="hover:text-[var(--brand-orange)]">
                  ブログ
                </a>
              </li>
              <li>
                <a href="/#contact" className="hover:text-[var(--brand-orange)]">
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-3 text-xs font-bold tracking-widest text-[var(--brand-gray-light)]">
              会社情報
            </h4>
            <ul className="space-y-2 text-sm text-[var(--brand-gray)]">
              <li>
                <strong className="text-[var(--brand-ink)]">ByakuyaAI</strong>
                <br />
                代表 岡本 壮司
              </li>
              <li>
                <a
                  href="mailto:info@byakuyaai.com"
                  className="hover:text-[var(--brand-orange)]"
                >
                  info@byakuyaai.com
                </a>
              </li>
              <li>080-6260-9731</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--brand-border)] pt-6 text-xs text-[var(--brand-gray-light)] sm:flex-row">
          <span>© 2026 ByakuyaAI. All rights reserved.</span>
          <div className="flex flex-wrap justify-center gap-5">
            <a href="/tos" className="hover:text-[var(--brand-orange)]">
              利用規約
            </a>
            <a href="/privacy" className="hover:text-[var(--brand-orange)]">
              プライバシーポリシー
            </a>
            <a href="/tokushoho" className="hover:text-[var(--brand-orange)]">
              特定商取引法に基づく表示
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
