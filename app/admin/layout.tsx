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
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[var(--brand-orange)]">
            ByakuyaAI
          </span>
          <span className="text-sm text-gray-500">Admin</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/admin" className="text-gray-600 hover:text-gray-900">
            ダッシュボード
          </a>
          <a href="/admin/clients/new" className="text-gray-600 hover:text-gray-900">
            + 新規顧客
          </a>
          <a href="/" className="text-gray-400 hover:text-gray-600">
            LP →
          </a>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
