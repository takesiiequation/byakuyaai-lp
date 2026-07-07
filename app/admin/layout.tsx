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
            href="/admin/clients"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            顧客管理
          </a>
          <a
            href="/admin/media"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            BGM/SE
          </a>
          <a
            href="/admin/billing"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            経理
          </a>
          <a
            href="/admin/sales"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            営業リスト
          </a>
          <a
            href="/admin/line"
            className="text-gray-600 hover:text-[var(--brand-orange)] transition-colors"
          >
            LINE設定
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
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
            href="/admin/clients"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              />
            </svg>
            <span className="text-[10px] font-medium">顧客</span>
          </a>
          <a
            href="/admin/media"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
                d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-[10px] font-medium">BGM</span>
          </a>
          <a
            href="/admin/billing"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[10px] font-medium">経理</span>
          </a>
          <a
            href="/admin/sales"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
            <span className="text-[10px] font-medium">営業</span>
          </a>
          <a
            href="/admin/line"
            className="flex flex-col items-center gap-0.5 text-gray-500 active:text-[var(--brand-orange)] transition-colors py-1 px-2"
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <span className="text-[10px] font-medium">LINE</span>
          </a>
          <a
            href="/"
            className="flex flex-col items-center gap-0.5 text-gray-400 active:text-gray-600 transition-colors py-1 px-2"
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
