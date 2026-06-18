"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLAN_DEFAULTS: Record<string, number> = {
  light: 5,
  standard: 10,
  premium: 30,
};

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    client_id: "",
    company_name: "",
    plan: "standard",
    monthly_quota: 10,
    secret_key: "",
    approval_email: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, val: string | number) {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "plan" && typeof val === "string") {
        next.monthly_quota = PLAN_DEFAULTS[val] ?? 10;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      router.push("/admin");
    } else {
      setError(data.error || "登録に失敗しました");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin" className="text-gray-400 hover:text-gray-600">
          ← 戻る
        </a>
        <h1 className="text-2xl font-bold">新規顧客追加</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            クライアントID（英数字、変更不可）
          </label>
          <input
            type="text"
            value={form.client_id}
            onChange={(e) =>
              set("client_id", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
            }
            required
            placeholder="sugita"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">会社名</label>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            required
            placeholder="杉田商事"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">プラン</label>
          <select
            value={form.plan}
            onChange={(e) => set("plan", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          >
            <option value="light">ライト (5本/月)</option>
            <option value="standard">スタンダード (10本/月)</option>
            <option value="premium">プレミアム (30本/月)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            月間クォータ
          </label>
          <input
            type="number"
            value={form.monthly_quota}
            onChange={(e) => set("monthly_quota", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            シークレットキー（Webhook認証用）
          </label>
          <input
            type="text"
            value={form.secret_key}
            onChange={(e) => set("secret_key", e.target.value)}
            placeholder="byk_..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            通知先メール
          </label>
          <input
            type="email"
            value={form.approval_email}
            onChange={(e) => set("approval_email", e.target.value)}
            placeholder="info@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[var(--brand-orange)] text-white font-medium rounded-lg px-4 py-2.5 text-sm hover:bg-[var(--brand-orange-dark)] disabled:opacity-50 transition-colors"
        >
          {saving ? "登録中..." : "登録する"}
        </button>
      </form>
    </div>
  );
}
