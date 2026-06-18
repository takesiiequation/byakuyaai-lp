import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <a href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand-orange)] to-[var(--brand-orange-dark)] flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-[var(--brand-ink)]">
              ByakuyaAI
            </span>
            <span className="text-[11px] text-gray-400 font-medium tracking-wider uppercase">
              Admin
            </span>
          </div>
        </a>

        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <a
            href="/admin"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            ダッシュボード
          </a>
          <a
            href="/admin/clients/new"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            + 新規顧客
          </a>
          <a
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            LP
          </a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        {children}
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          <a
            href="/admin"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-4"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"
              />
            </svg>
            <span className="text-[10px] font-medium">ホーム</span>
          </a>
          <a
            href="/admin/clients/new"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-4"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span className="text-[10px] font-medium">新規</span>
          </a>
          <a
            href="/"
            className="flex flex-col items-center gap-0.5 text-gray-400 active:text-gray-600 transition-colors py-1 px-4"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            <span className="text-[10px] font-medium">LP</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
