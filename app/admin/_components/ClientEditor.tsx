"use client";

import { useState } from "react";
import type { Client } from "@/app/_lib/types";

interface FieldDef {
  key: string;
  label: string;
  type?: string;
  sensitive?: boolean;
  options?: { value: string; label: string }[];
}

interface Section {
  title: string;
  fields: FieldDef[];
}

export default function ClientEditor({
  client,
  sections,
}: {
  client: Client;
  sections: Section[];
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(client).map(([k, v]) => [k, String(v ?? "")])
    )
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const hasChanges = Object.entries(form).some(
    ([k, v]) =>
      v !== String((client as unknown as Record<string, unknown>)[k] ?? "")
  );

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const changed: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (
        v !==
        String((client as unknown as Record<string, unknown>)[k] ?? "")
      ) {
        changed[k] = v;
      }
    }
    if (Object.keys(changed).length === 0) {
      setMsg({ text: "変更がありません", ok: true });
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/clients/${client.client_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changed),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? { text: "保存しました", ok: true }
        : { text: data.error || "保存に失敗しました", ok: false }
    );
    setSaving(false);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {sections.map((s) => (
        <div
          key={s.title}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              {s.title}
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s.fields.map((f) => {
                const val = form[f.key] ?? "";
                const isSensitive =
                  f.sensitive && val && !revealed.has(f.key);

                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {f.label}
                    </label>
                    {f.type === "select" && f.options ? (
                      <select
                        value={val}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors appearance-none"
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        <input
                          type={
                            f.type === "number"
                              ? "number"
                              : isSensitive
                                ? "password"
                                : "text"
                          }
                          value={val}
                          onChange={(e) => set(f.key, e.target.value)}
                          className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors pr-14"
                        />
                        {f.sensitive && val && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealed((r) => {
                                const next = new Set(r);
                                next.has(f.key)
                                  ? next.delete(f.key)
                                  : next.add(f.key);
                                return next;
                              })
                            }
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-[var(--brand-orange)] bg-white border border-gray-200 rounded-lg px-2 py-1 transition-colors active:scale-95"
                          >
                            {isSensitive ? "表示" : "隠す"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <div className="hidden sm:flex items-center gap-4 pt-2">
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-8 py-2.5 text-sm hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {msg && (
          <span
            className={`text-sm font-medium ${msg.ok ? "text-green-600" : "text-red-500"}`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 px-4 pb-3 pt-2 bg-gradient-to-t from-gray-50 via-gray-50 to-gray-50/0">
        {msg && (
          <div
            className={`text-center text-sm font-medium mb-2 ${msg.ok ? "text-green-600" : "text-red-500"}`}
          >
            {msg.text}
          </div>
        )}
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-3.5 text-base shadow-lg shadow-[var(--brand-orange)]/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {saving ? "保存中..." : hasChanges ? "変更を保存" : "変更なし"}
        </button>
      </div>
    </div>
  );
}
