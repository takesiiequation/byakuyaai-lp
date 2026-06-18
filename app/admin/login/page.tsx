"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("パスワードが違います");
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm"
      >
        <h1 className="text-xl font-bold mb-6 text-center">
          ByakuyaAI Admin
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent"
          autoFocus
        />
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--brand-orange)] text-white font-medium rounded-lg px-4 py-2.5 text-sm hover:bg-[var(--brand-orange-dark)] disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
