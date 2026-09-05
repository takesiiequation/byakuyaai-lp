// ユキのデスク・チャット本体(R2.5: デスクユキ=Fargateランタイム・Claude Codeらしい作業ログ)
// 意匠は CompanionChat.tsx を踏襲(吹き出し・入力欄・スピナー3層)。器は会社(client_id)スコープ。
// 通信: POST /api/portal/yuki/run → job_id → GET /api/portal/yuki/job をポーリング(イベント断片を描く)。
//   text_start/text=ユキの発話(逐次) / tool・tool_result=作業の1手(カード) / deny(proposal)=承認カード / done=クレジットのバー更新
// 復元: 進行中ジョブは localStorage に控え、画面を開き直しても続きから描く(断片はサーバーに残っているので cursor='' で全部やり直す)
"use client";

import { useEffect, useRef, useState } from "react";
import { pickSpinner, nextInterval, FIRST_LABEL, FIRST_HOLD_MS } from "@/app/_lib/spinner";
import LiteMd from "@/app/_lib/lite_md";

type Part = { kind: "text"; text: string } | { kind: "step"; label: string; done: boolean; failed?: boolean };
interface Msg { role: "user" | "assistant"; content: string; parts?: Part[]; live?: boolean; }
interface Proposal { tool: string; args_hash: string; cost_label: string; }
interface CreditsView { stage: string; pct10: number; exhausted: boolean; }

const STARTERS = ["動画の設計図を検査してほしい", "物件の紹介文を一緒に考えたい", "うちの会社のことを覚えてもらう"];
// 道具→作業の言葉(内部の道具名は出さない)
const TOOL_LABEL: Record<string, string> = {
  mcp__byakuyaai__memory_list: "記憶ノートの索引を確認", mcp__byakuyaai__memory_read: "記憶ノートを読む", mcp__byakuyaai__memory_write: "記憶ノートを整理",
  mcp__byakuyaai__video_list: "動画の一覧を確認", mcp__byakuyaai__video_info: "設計図を読む",
  mcp__byakuyaai__layout_lint: "レイアウトを検査", mcp__byakuyaai__props_lint: "設計図を検査",
  mcp__byakuyaai__credits_balance: "今月の稼働を確認", mcp__byakuyaai__render_lambda: "動画を仕上げ直す(数分)",
  mcp__byakuyaai__seedance_regenerate: "映像を作り直す", mcp__byakuyaai__human_support: "担当者に申し送り",
  Read: "机の上の資料を確認", Write: "資料を書く", Edit: "設計図を直す", Glob: "机の上を探す", Grep: "机の上を探す",
};
const labelOf = (name: string) => TOOL_LABEL[name] || (name.startsWith("mcp__byakuyaai__") ? "作業中" : "机の上を確認");
const POLL_MS = 1500;
const LS_KEY = "yuki_desk_active_job";

function CreditsBar({ c }: { c: CreditsView | null }) {
  const pct = c ? c.pct10 : 0;
  const filled = Math.round(pct / 10);
  return (
    <div className="border-b border-black/5 px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[11px] font-bold text-[#888]">今月のユキクレジット</span>
        <div className="flex flex-1 gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={"h-2 flex-1 rounded-sm " + (i < filled ? (pct >= 80 ? "bg-orange-400" : "bg-amber-300") : "bg-black/10")} />
          ))}
        </div>
        <span className="shrink-0 text-[11px] text-[#666]">{c ? c.stage : "確認中"}</span>
      </div>
    </div>
  );
}

/** ユキの吹き出し: 発話と作業の1手(ステップ)を時間順に描く。ステップが多い時は折りたたむ */
function AssistantBubble({ m }: { m: Msg }) {
  const [open, setOpen] = useState(false);
  const parts = m.parts && m.parts.length ? m.parts : [{ kind: "text", text: m.content } as Part];
  const steps = parts.filter((p) => p.kind === "step").length;
  const collapsible = steps > 4 && !m.live;
  return (
    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-3 text-sm text-[#222] lg:max-w-[88%] lg:px-6 lg:py-4 lg:text-[15.5px]">
      {collapsible && (
        <button onClick={() => setOpen((v) => !v)} className="mb-2 flex items-center gap-1 text-xs font-bold text-[#c96a00]">
          <span className={"inline-block transition-transform " + (open ? "rotate-90" : "")}>▶</span> 作業の記録({steps}手){open ? "を閉じる" : "を見る"}
        </button>
      )}
      {parts.map((p, i) =>
        p.kind === "text" ? (
          p.text.trim() ? <div key={i} className={i > 0 ? "mt-2" : ""}><LiteMd text={p.text} /></div> : null
        ) : (collapsible && !open) ? null : (
          <div key={i} className="my-1.5 flex items-center gap-2 rounded-lg border border-black/5 bg-white/70 px-2.5 py-1.5 text-xs text-[#555]">
            {p.done ? <span className={"font-black " + (p.failed ? "text-red-500" : "text-emerald-600")}>{p.failed ? "!" : "✓"}</span> : <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />}
            <span>{p.label}{p.done ? "" : "…"}</span>
          </div>
        ),
      )}
    </div>
  );
}

export default function YukiDesk({ clientName }: { clientName: string }) {
  const greeting = `こんにちは、${clientName ? `${clientName}さま専任の` : ""}AI担当 ユキです😊\n今日はどんなご相談でしょうか?`;
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(FIRST_LABEL);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [credits, setCredits] = useState<CreditsView | null>(null);
  const [finishedBanner, setFinishedBanner] = useState(false);
  const seriousRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const resumedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/portal/yuki/history").then((r) => r.json()).then((d: { ok?: boolean; messages?: Msg[] }) => {
      if (alive && d.ok && d.messages?.length) setMessages([{ role: "assistant", content: greeting }, ...d.messages.map((m) => ({ role: m.role, content: m.content }))]);
      // 進行中のジョブがあれば続きから描く(履歴の後ろに付く)
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw && !resumedRef.current) {
          const a = JSON.parse(raw) as { job_id: string; prompt: string; at: number };
          if (a.job_id && Date.now() - a.at < 40 * 60_000) { resumedRef.current = true; void followJob(a.job_id, a.prompt, true); }
          else localStorage.removeItem(LS_KEY);
        }
      } catch {}
    }).catch(() => {});
    fetch("/api/portal/yuki/credits").then((r) => r.json()).then((d: { ok?: boolean; credits?: CreditsView }) => { if (alive && d.ok && d.credits) setCredits(d.credits); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (nearBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, proposal]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    let funUsed = false; let prev = FIRST_LABEL;
    setSpinner(FIRST_LABEL);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (statusRef.current) setSpinner(statusRef.current);
      else { const p = pickSpinner(Date.now() - started, seriousRef.current, funUsed, prev); if (p.isFun) funUsed = true; prev = p.text; setSpinner(p.text); }
      timer = setTimeout(tick, nextInterval());
    };
    timer = setTimeout(tick, FIRST_HOLD_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  // 今描いている吹き出し(live)への追記
  const withLive = (fn: (m: Msg) => Msg) =>
    setMessages((cur) => {
      const i = cur.map((m) => !!m.live).lastIndexOf(true);
      if (i < 0) return [...cur, fn({ role: "assistant", content: "", parts: [], live: true })];
      const next = cur.slice(); next[i] = fn(cur[i]); return next;
    });
  // 新しい発話の始まり: 今の吹き出しがまだ作業カードだけ(本文なし)なら、その中に続ける(カードと本文を分けない)
  const startBubble = () => setMessages((cur) => {
    const i = cur.map((m) => !!m.live).lastIndexOf(true);
    if (i >= 0 && !cur[i].content.trim()) return cur;
    return [...cur.map((m) => ({ ...m, live: false })), { role: "assistant", content: "", parts: [], live: true }];
  });
  const addText = (t: string) => withLive((m) => {
    const parts = [...(m.parts ?? [])];
    const last = parts[parts.length - 1];
    if (last && last.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + t }; else parts.push({ kind: "text", text: t });
    return { ...m, parts, content: m.content + t };
  });
  const addStep = (label: string) => withLive((m) => ({ ...m, parts: [...(m.parts ?? []), { kind: "step", label, done: false }] }));
  const finishStep = (failed = false) => withLive((m) => {
    const parts = [...(m.parts ?? [])];
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; if (p.kind === "step" && !p.done) { parts[i] = { ...p, done: true, failed }; break; } }
    return { ...m, parts };
  });
  const seal = () => setMessages((cur) => cur.map((m) => ({ ...m, live: false })).filter((m) => !(m.role === "assistant" && !m.content.trim() && !(m.parts ?? []).some((p) => p.kind === "step"))));

  /** ジョブの断片を追いかけて描く(送信直後・画面を開き直した時の両方から呼ぶ) */
  async function followJob(jobId: string, prompt: string, resumed = false) {
    setBusy(true); statusRef.current = null; setError(null); setFinishedBanner(false);
    if (resumed) setMessages((cur) => [...cur, { role: "user", content: prompt }]);
    let cursor = ""; let got = 0; let pendingProposal: Proposal | null = null; let failed: string | null = null;
    try {
      for (let i = 0; i < 1600; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pr = await fetch(`/api/portal/yuki/job?job_id=${encodeURIComponent(jobId)}&cursor=${encodeURIComponent(cursor)}`);
        if (pr.status === 401) { failed = "ログインが切れました。もう一度ログインしてください"; break; }
        const pd = (await pr.json()) as { ok?: boolean; events?: Array<Record<string, unknown>>; cursor?: string; done?: boolean; status?: string; error?: string; credits?: CreditsView };
        if (!pd.ok) { failed = pd.error || "failed"; break; }
        cursor = pd.cursor || cursor;
        for (const ev of pd.events ?? []) {
          const t = String(ev.type);
          if (t === "text_start") startBubble();
          else if (t === "text" && typeof ev.text === "string") { got += ev.text.length; addText(ev.text); }
          else if (t === "tool") { const lbl = labelOf(String(ev.name)); statusRef.current = lbl + "しています"; setSpinner(lbl + "しています"); if (String(ev.name) !== "ToolSearch") addStep(lbl); }
          else if (t === "tool_result") { statusRef.current = null; if (String(ev.name) !== "ToolSearch") finishStep(false); }
          else if (t === "deny") { statusRef.current = null; finishStep(true); if (ev.proposal) { const p = ev.proposal as Proposal; if (p.tool && p.args_hash) pendingProposal = p; } }
          else if (t === "error" && typeof ev.message === "string") failed = ev.message;
        }
        if (pd.done) { if (pd.credits) setCredits(pd.credits); if (pd.status === "error" && pd.error) failed = pd.error; break; }
      }
    } catch { failed = failed || "通信に失敗しました。電波の良いところでお試しください。"; }
    try { localStorage.removeItem(LS_KEY); } catch {}
    seal();
    if (pendingProposal) setProposal(pendingProposal);
    if (failed && got) setMessages((cur) => [...cur, { role: "assistant", content: "すみません、途中で処理が止まってしまいました🙏 もう一度お送りいただけますか?" }]);
    else if (!got && failed) setError(failed.length < 120 ? failed : "処理に失敗しました。時間をおいてお試しください。");
    else if (!got) setMessages((cur) => [...cur, { role: "assistant", content: "申し訳ございません、確認に手間取っております。もう一度お送りいただけますか?" }]);
    if (got && (document.hidden || !nearBottomRef.current)) setFinishedBanner(true);
    if (document.hidden) { const t = document.title; document.title = "✅ ユキの作業が終わりました"; const back = () => { document.title = t; document.removeEventListener("visibilitychange", back); }; document.addEventListener("visibilitychange", back); }
    setBusy(false);
  }

  async function send(text: string, grant?: Proposal | null) {
    const body = text.trim();
    if (!body || busy) return;
    setError(null); setProposal(null);
    setMessages((cur) => [...cur.map((m) => ({ ...m, live: false })), { role: "user", content: body }]);
    setInput(""); nearBottomRef.current = true;
    if (/解約|クレーム|苦情|返金|法律|訴/.test(body)) seriousRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/yuki/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: body, ...(grant ? { paid_grant: { tool: grant.tool, args_hash: grant.args_hash } } : {}) }) });
      const d = (await res.json()) as { ok?: boolean; job_id?: string; error?: string; credits?: CreditsView };
      if (!d.ok || !d.job_id) { setError(d.error && d.error.length < 120 ? d.error : "送信に失敗しました。時間をおいてお試しください。"); if (d.credits) setCredits(d.credits); setBusy(false); return; }
      try { localStorage.setItem(LS_KEY, JSON.stringify({ job_id: d.job_id, prompt: body, at: Date.now() })); } catch {}
      await followJob(d.job_id, body);
    } catch {
      setError("通信に失敗しました。電波の良いところでお試しください。"); setBusy(false);
    }
  }

  const fresh = messages.length <= 1;
  const exhausted = !!credits?.exhausted;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] min-h-[520px] w-full flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:h-[calc(100dvh-10.5rem)]">
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-lg font-black text-white">ユ</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#222]">{clientName ? `${clientName}さま専任 ` : ""}AI担当 ユキ</p>
          <p className="text-xs text-[#888]">動画の設計図・記憶ノート・日々のご相談を承ります</p>
        </div>
        <a href="/portal" className="ml-auto shrink-0 text-xs text-[#999] underline">マイページ</a>
      </header>
      <CreditsBar c={credits} />

      <div ref={scrollerRef} onScroll={(e) => { const el = e.currentTarget; nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (nearBottomRef.current) setFinishedBanner(false); }} className="relative flex-1 space-y-3 overflow-y-auto px-3 py-4 lg:space-y-4 lg:px-6 lg:py-6">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {m.role === "user" ? (
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500 px-4 py-2.5 text-sm leading-relaxed text-white lg:max-w-[70%] lg:text-[15px]">{m.content}</div>
            ) : (m.content.trim() || (m.parts ?? []).some((p) => p.kind === "step")) ? (
              <AssistantBubble m={m} />
            ) : null}
          </div>
        ))}

        {fresh && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => void send(s)} className="rounded-full border border-[#f7931e]/40 bg-[#fff8f0] px-3 py-1.5 text-xs font-bold text-[#c96a00]">{s}</button>
            ))}
          </div>
        )}

        {proposal && !busy && (
          <div className="rounded-2xl border border-orange-300 bg-[#fff8f0] px-4 py-3 text-sm text-[#222]">
            <p className="font-bold">この操作には <span className="text-[#c96a00]">{proposal.cost_label}</span> がかかります。実行してよろしいですか?</p>
            <p className="mt-1 text-xs text-[#777]">承認するとユキが先ほどの操作を実行します。迷う点があれば、承認の前にそのまま質問してください。</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void send("承認しました。先ほどご提案の操作を実行してください。", proposal)} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">承認して実行</button>
              <button onClick={() => setProposal(null)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-[#555]">今はやめる</button>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-2.5 text-sm text-[#888]">{spinner}…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {finishedBanner && (
        <button onClick={() => { setFinishedBanner(false); nearBottomRef.current = true; bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="mx-4 mb-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
          ✅ ユキの作業が終わりました。結果を見る
        </button>
      )}
      {error && <p className="px-4 pb-1 text-xs font-bold text-red-500">{error}</p>}
      {exhausted && <p className="px-4 pb-1 text-xs font-bold text-[#c96a00]">今月のユキクレジットの枠を使い切りました。来月また一緒に働けます(ご相談の閲覧はできます)</p>}

      <div className="flex items-end gap-2 border-t border-black/5 p-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
          rows={2} maxLength={4000} disabled={exhausted} placeholder={exhausted ? "今月の枠を使い切りました" : busy ? "ユキが作業中です(終わったら続けて送れます)" : "ご相談・ご依頼を入力"}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:bg-black/5 lg:min-h-[72px] lg:text-[15px]" />
        <button onClick={() => void send(input)} disabled={busy || exhausted || !input.trim()} className="h-[44px] shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-40">送信</button>
      </div>
    </div>
  );
}
