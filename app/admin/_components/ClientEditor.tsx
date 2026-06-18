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

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const changed: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v !== String((client as unknown as Record<string, unknown>)[k] ?? "")) {
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
    <div className="space-y-6">
      {sections.map((s) => (
        <div
          key={s.title}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-4">
            {s.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.fields.map((f) => {
              const val = form[f.key] ?? "";
              const isSensitive = f.sensitive && val && !revealed.has(f.key);

              return (
                <div key={f.key}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {f.label}
                  </label>
                  {f.type === "select" && f.options ? (
                    <select
                      value={val}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
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
      ))}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-[var(--brand-orange)] text-white font-medium rounded-lg px-6 py-2.5 text-sm hover:bg-[var(--brand-orange-dark)] disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
