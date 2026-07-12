"use client";

import { useState } from "react";

// Keeps the finished-videos tail out of view by default so a long-running
// client's page doesn't grow unbounded with 投稿済み rows (Okamoto's
// concern) — PortalPage renders every active row plus only the 5 most
// recent terminal rows up front, and passes the rest in here as `children`
// (already-rendered <StatusRow>s, a Server Component). React fragments
// don't create a wrapping DOM node, so these still land as direct children
// of the parent's `divide-y` list — the border-between-rows styling keeps
// working across the client/server boundary.
export default function CollapsedHistory({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;

  return (
    <>
      <div className="p-3 text-center">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-[var(--brand-gray-light)] hover:text-[var(--brand-orange)] transition-colors"
        >
          {expanded ? "閉じる" : `過去の動画をすべて表示(${count}件)`}
        </button>
      </div>
      {expanded ? children : null}
    </>
  );
}
