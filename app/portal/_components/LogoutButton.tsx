"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } catch {
      // ignore — the redirect below still runs, and a stale cookie just
      // fails verification server-side next time (fail-closed).
    }
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm font-medium text-gray-500 hover:text-[var(--brand-orange)] transition-colors disabled:opacity-50"
    >
      {loading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
