"use client";

import { useState } from "react";

export default function MeLogin() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/me/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = await r.json();
      if (j.ok) { location.href = "/me"; return; }
      setErr(j.error || "入れませんでした");
    } catch {
      setErr("通信に失敗しました");
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24,
      background: "var(--me-bg,#16181B)", color: "var(--me-ink,#ECEEF0)",
      fontFamily: '"Zen Kaku Gothic New",-apple-system,"Hiragino Sans",sans-serif',
    }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 300, textAlign: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: ".02em" }}>85</div>
        <div style={{ fontSize: 13, color: "#8A9184", marginBottom: 26 }}>85点の毎日</div>
        <input
          type="password" inputMode="numeric" autoFocus value={pin}
          onChange={(e) => setPin(e.target.value)} placeholder="PIN"
          aria-label="PIN"
          style={{
            width: "100%", padding: "13px 14px", fontSize: 20, textAlign: "center",
            letterSpacing: ".3em", borderRadius: 10, border: "1px solid #3C424A",
            background: "#1E2126", color: "#ECEEF0",
            fontFamily: '"IBM Plex Mono",monospace',
          }}
        />
        <button type="submit" disabled={busy || !pin.trim()} style={{
          width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 10, border: "none",
          background: busy || !pin.trim() ? "#25292E" : "#45D183",
          color: busy || !pin.trim() ? "#6E757D" : "#12140F",
          fontSize: 15, fontWeight: 900, cursor: "pointer",
          fontFamily: "inherit",
        }}>{busy ? "確認中…" : "入る"}</button>
        {err && <div style={{ marginTop: 12, fontSize: 12.5, color: "#E0736A" }}>{err}</div>}
      </form>
    </div>
  );
}
