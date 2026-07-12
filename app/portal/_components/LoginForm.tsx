"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({
  initialClientId = "",
}: {
  initialClientId?: string;
}) {
  const [clientId, setClientId] = useState(initialClientId);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId.trim(), password }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        router.push("/portal");
        router.refresh();
      } else {
        setError(data.error || "IDまたはパスワードが違います");
      }
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください");
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center px-4">
      {/* 2026-07-13: 白すりガラス化(岡本指示)に伴い、見出し/フッター注記も
          動画上に浮かせる旧構成からカード内へ統合。すべての文字がガラス板
          の上に乗るため text-shadow は不要になり、brand-ink 系の濃色文字に
          統一している。 */}
      <div className="w-full max-w-sm liquid-glass-white rounded-2xl shadow-2xl shadow-black/20 p-6 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-orange)] to-[var(--brand-orange-light)] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--brand-orange)]/20">
            <span className="text-white text-2xl font-bold">B</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--brand-ink)]">
            マイページログイン
          </h1>
          <p className="text-sm text-[var(--brand-ink)]/60 mt-1">
            ByakuyaAI Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--brand-ink)]/70 mb-2">
              顧客ID
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="ご案内のIDを入力"
              className="w-full border border-black/10 bg-white/80 text-[var(--brand-ink)] placeholder:text-black/35 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white/95 transition-colors"
              autoFocus={!initialClientId}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--brand-ink)]/70 mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="w-full border border-black/10 bg-white/80 text-[var(--brand-ink)] placeholder:text-black/35 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white/95 transition-colors"
              autoFocus={!!initialClientId}
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !clientId.trim() || !password}
            className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3.5 text-base hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="text-center text-xs text-[var(--brand-ink)]/50 mt-4">
          IDとパスワードがご不明な場合は担当者までご連絡ください。
        </p>
      </div>
    </div>
  );
}
