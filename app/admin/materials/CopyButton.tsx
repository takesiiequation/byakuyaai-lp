"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("コピーしてください", text);
        }
      }}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)]"
    >
      {done ? "コピーしました" : "URLをコピー"}
    </button>
  );
}
