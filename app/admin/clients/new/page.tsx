"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLAN_DEFAULTS: Record<string, number> = {
  light: 5,
  standard: 10,
  premium: 30,
};

const PLAN_OPTIONS = [
  { value: "light", label: "ライト", quota: 5 },
  { value: "standard", label: "スタンダード", quota: 10 },
  { value: "premium", label: "プレミアム", quota: 30 },
];

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

  const isValid = form.client_id && form.company_name;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <a
          href="/admin"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)] active:scale-95 transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </a>
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          新規顧客追加
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
      >
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              クライアントID
              <span className="text-gray-400 font-normal ml-1">
                英数字・変更不可
              </span>
            </label>
            <input
              type="text"
              value={form.client_id}
              onChange={(e) =>
                set(
                  "client_id",
                  e.target.value.replace(/[^a-zA-Z0-9_-]/g, "")
                )
              }
              required
              placeholder="sugita"
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              会社名
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              required
              placeholder="杉田商事"
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              プラン
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("plan", p.value)}
                  className={`relative rounded-xl border-2 px-3 py-3 text-center transition-all active:scale-[0.97] ${
                    form.plan === p.value
                      ? "border-[var(--brand-orange)] bg-[var(--brand-cream)] text-[var(--brand-orange-dark)]"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.quota}本/月
                  </div>
                  {form.plan === p.value && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--brand-orange)] flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              月間クォータ
            </label>
            <input
              type="number"
              value={form.monthly_quota}
              onChange={(e) => set("monthly_quota", e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              シークレットキー
              <span className="text-gray-400 font-normal ml-1">
                Webhook認証用
              </span>
            </label>
            <input
              type="text"
              value={form.secret_key}
              onChange={(e) => set("secret_key", e.target.value)}
              placeholder="byk_..."
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              通知先メール
            </label>
            <input
              type="email"
              value={form.approval_email}
              onChange={(e) => set("approval_email", e.target.value)}
              placeholder="info@example.com"
              className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mb-4 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || !isValid}
            className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-3.5 text-base hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            {saving ? "登録中..." : "登録する"}
          </button>
        </div>
      </form>
    </div>
  );
}
