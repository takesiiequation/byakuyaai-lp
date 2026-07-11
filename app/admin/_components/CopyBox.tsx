"use client";

import { useState } from "react";

// Small copy-to-clipboard box used by /admin/manual step cards (and reusable
// anywhere else in admin). Value is resolved server-side and passed in as a
// plain prop — this component itself never touches env/secrets.
export default function CopyBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const empty = !value;

  async function handleCopy() {
    if (empty) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (non-HTTPS, old browser, permission
      // denied) — fail soft, no crash, user can still select-and-copy the
      // text manually since it's shown in full.
    }
  }

  return (
    <div className="mt-2">
      <div className="text-[11px] font-medium text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 min-w-0 truncate text-xs font-mono px-3 py-2 rounded-lg border ${
            empty
              ? "bg-gray-50 text-gray-400 border-gray-200"
              : "bg-gray-50 text-[var(--brand-ink)] border-gray-200"
          }`}
        >
          {empty ? "(env未設定)" : value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={empty}
          className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? "コピー済" : "コピー"}
        </button>
      </div>
    </div>
  );
}
