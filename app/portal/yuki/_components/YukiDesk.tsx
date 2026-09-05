// ユキのデスク・チャット本体(R2: デスクユキ=Fargateランタイムに接続)
// 意匠は CompanionChat.tsx を踏襲(吹き出し・入力欄・スピナー3層)。
// 器の違い: approval_id ではなく **会社(client_id)** スコープ。
// 通信: POST /api/portal/yuki/run → job_id → GET /api/portal/yuki/job をポーリング(イベント断片を描く)。
//   text_start/text=ユキの発話(逐次) / tool=作業中の表示 / deny(proposal)=承認カード / done=クレジットのバー更新
"use client";

import { useEffect, useRef, useState } from "react";
import { pickSpinner, nextInterval, FIRST_LABEL, FIRST_HOLD_MS } from "@/app/_lib/spinner";
import LiteMd from "@/app/_lib/lite_md";

interface Msg { role: "user" | "assistant"; content: string; }
interface Proposal { tool: string; args_hash: string; cost_label: string; }
interface CreditsView { stage: string; pct10: number; exhausted: boolean; }

// 用途チップ: 空のチャット欄を前に固まるのを防ぐ
const STARTERS = ["動画の設計図を検査してほしい", "物件の紹介文を一緒に考えたい", "うちの会社のことを覚えてもらう"];
// 道具→作業中の言葉(第1層。内部の道具名は出さない)
const TOOL_LABEL: Record<string, string> = {
  mcp__byakuyaai__memory_list: "記憶ノートを確認しています", mcp__byakuyaai__memory_read: "記憶ノートを読んでいます", mcp__byakuyaai__memory_write: "記憶ノートを整理しています",
  mcp__byakuyaai__video_list: "動画の一覧を確認しています", mcp__byakuyaai__video_info: "設計図を読んでいます",
  mcp__byakuyaai__layout_lint: "レイアウトを検査しています", mcp__byakuyaai__props_lint: "設計図を検査しています",
  mcp__byakuyaai__credits_balance: "今月の稼働を確認しています", mcp__byakuyaai__render_lambda: "動画を仕上げ直しています(数分かかります)",
  mcp__byakuyaai__human_support: "担当者に申し送りしています", Read: "机の上の資料を確認しています", Write: "資料を書いています", Edit: "設計図を直しています", Glob: "机の上を探しています", Grep: "机の上を探しています",
};
const POLL_MS = 1500;

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

export default function YukiDesk({ clientName }: { clientName: string }) {
  const greeting = `こんにちは、${clientName ? `${clientName}さま専任の` : ""}AI担当 ユキです😊\n今日はどんなご相談でしょうか?`;
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(FIRST_LABEL);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [credits, setCredits] = useState<CreditsView | null>(null);
  const seriousRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/portal/yuki/history").then((r) => r.json()).then((d: { ok?: boolean; messages?: Msg[] }) => {
      if (alive && d.ok && d.messages?.length) setMessages([{ role: "assistant", content: greeting }, ...d.messages]);
    }).catch(() => {});
    fetch("/api/portal/yuki/credits").then((r) => r.json()).then((d: { ok?: boolean; credits?: CreditsView }) => { if (alive && d.ok && d.credits) setCredits(d.credits); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, proposal]);

  // 待機中の語を回す(最初の3秒は固定→以降4〜6秒。道具のstatusが来たらそれを優先)
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

  const appendAssistant = (text: string, newBubble: boolean) => {
    setMessages((cur) => {
      const last = cur[cur.length - 1];
      if (!newBubble && last && last.role === "assistant" && last.content !== greeting && (last as Msg & { live?: boolean }).live) {
        const next = cur.slice(0, -1); next.push({ ...last, content: last.content + text }); return next;
      }
      return [...cur, { role: "assistant", content: text, live: true } as Msg];
    });
  };
  const sealBubbles = () => setMessages((cur) => cur.map((m) => { const c = { ...m } as Msg & { live?: boolean }; delete c.live; return c; }));

  async function send(text: string, grant?: Proposal | null) {
    const body = text.trim();
    if (!body || busy) return;
    setError(null); setProposal(null);
    setMessages((cur) => [...cur, { role: "user", content: body }]);
    setInput(""); setBusy(true); statusRef.current = null;
    if (/解約|クレーム|苦情|返金|法律|訴/.test(body)) seriousRef.current = true;
    try {
      const res = await fetch("/api/portal/yuki/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: body, ...(grant ? { paid_grant: { tool: grant.tool, args_hash: grant.args_hash } } : {}) }) });
      const d = (await res.json()) as { ok?: boolean; job_id?: string; error?: string; credits?: CreditsView };
      if (!d.ok || !d.job_id) { setError(d.error && d.error.length < 120 ? d.error : "送信に失敗しました。時間をおいてお試しください。"); if (d.credits) setCredits(d.credits); return; }
      let cursor = ""; let got = 0; let pendingProposal: Proposal | null = null; let failed: string | null = null;
      for (let i = 0; i < 1200; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pr = await fetch(`/api/portal/yuki/job?job_id=${encodeURIComponent(d.job_id)}&cursor=${encodeURIComponent(cursor)}`);
        if (pr.status === 401) { failed = "ログインが切れました。もう一度ログインしてください"; break; }
        const pd = (await pr.json()) as { ok?: boolean; events?: Array<Record<string, unknown>>; cursor?: string; done?: boolean; status?: string; error?: string; credits?: CreditsView };
        if (!pd.ok) { failed = pd.error || "failed"; break; }
        cursor = pd.cursor || cursor;
        for (const ev of pd.events ?? []) {
          const t = String(ev.type);
          if (t === "text_start") appendAssistant("", true);
          else if (t === "text" && typeof ev.text === "string") { got += ev.text.length; appendAssistant(ev.text, false); }
          else if (t === "tool") { const lbl = TOOL_LABEL[String(ev.name)] || "作業しています"; statusRef.current = lbl; setSpinner(lbl); }
          else if (t === "deny" && ev.proposal) { const p = ev.proposal as Proposal; if (p.tool && p.args_hash) pendingProposal = p; }
          else if (t === "error" && typeof ev.message === "string") failed = ev.message;
        }
        if (pd.done) { if (pd.credits) setCredits(pd.credits); if (pd.status === "error" && pd.error) failed = pd.error; break; }
      }
      sealBubbles();
      // 空の吹き出しを掃除
      setMessages((cur) => cur.filter((m) => !(m.role === "assistant" && !m.content.trim())));
      if (pendingProposal) setProposal(pendingProposal);
      if (failed && got) setMessages((cur) => [...cur, { role: "assistant", content: "すみません、途中で処理が止まってしまいました🙏 もう一度お送りいただけますか?" }]);
      else if (!got && failed) setError(failed.length < 120 ? failed : "処理に失敗しました。時間をおいてお試しください。");
      else if (!got) setMessages((cur) => [...cur, { role: "assistant", content: "申し訳ございません、確認に手間取っております。もう一度お送りいただけますか?" }]);
    } catch {
      setError("通信に失敗しました。電波の良いところでお試しください。");
    } finally { setBusy(false); }
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

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 lg:space-y-4 lg:px-6 lg:py-6">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500 px-4 py-2.5 text-sm leading-relaxed text-white lg:max-w-[70%] lg:text-[15px]"
              : "max-w-[90%] rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-3 text-sm text-[#222] lg:max-w-[88%] lg:px-6 lg:py-4 lg:text-[15.5px]"}>
              {m.role === "user" ? m.content : <LiteMd text={m.content} />}
            </div>
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
            <p className="mt-1 text-xs text-[#777]">承認するとユキが先ほどの操作を実行します。やめる場合は何もしなくて大丈夫です。</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void send("承認しました。先ほどご提案の操作を実行してください。", proposal)} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">承認して実行</button>
              <button onClick={() => setProposal(null)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-[#555]">やめる</button>
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

      {error && <p className="px-4 pb-1 text-xs font-bold text-red-500">{error}</p>}
      {exhausted && <p className="px-4 pb-1 text-xs font-bold text-[#c96a00]">今月のユキクレジットの枠を使い切りました。来月また一緒に働けます(ご相談の閲覧はできます)</p>}

      <div className="flex items-end gap-2 border-t border-black/5 p-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
          rows={2} maxLength={4000} disabled={exhausted} placeholder={exhausted ? "今月の枠を使い切りました" : "ご相談・ご依頼を入力"}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:bg-black/5 lg:min-h-[72px] lg:text-[15px]" />
        <button onClick={() => void send(input)} disabled={busy || exhausted || !input.trim()} className="h-[44px] shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-40">送信</button>
      </div>
    </div>
  );
}
