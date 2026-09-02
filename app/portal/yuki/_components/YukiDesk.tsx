// ユキのデスク・チャット本体(P0: 単一スレッド)
// 意匠は CompanionChat.tsx を踏襲(吹き出し・入力欄・NDJSON逐次発話・スピナー3層)。
// 器の違い: approval_id ではなく **会社(client_id)** スコープ。動画に紐づかない相談を扱う。
"use client";

import { useEffect, useRef, useState } from "react";
import { pickSpinner, nextInterval, FIRST_LABEL, FIRST_HOLD_MS } from "@/app/_lib/spinner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// 用途チップ: 空のチャット欄を前に固まるのを防ぐ(何を頼んでいいか分からない、の解消)
const STARTERS = [
  "物件の紹介文を一緒に考えたい",
  "SNSの反響について相談したい",
  "うちの会社のことを覚えてもらう",
];

export default function YukiDesk({ clientName }: { clientName: string }) {
  const greeting = `こんにちは、${clientName ? `${clientName}さま専任の` : ""}AI担当 ユキです😊\n今日はどんなご相談でしょうか?`;
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(FIRST_LABEL);
  const seriousRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 会話の復元(デスクを離れても続きから話せる)
  useEffect(() => {
    let alive = true;
    fetch("/api/portal/yuki/history")
      .then((r) => r.json())
      .then((d: { ok?: boolean; messages?: Msg[] }) => {
        if (alive && d.ok && d.messages?.length) {
          setMessages([{ role: "assistant", content: greeting }, ...d.messages]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // 待機中の語を回す(最初の3秒は固定→以降4〜6秒。道具のstatusが来たらそれを優先)
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    let funUsed = false;
    let prev = FIRST_LABEL;
    setSpinner(FIRST_LABEL);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (statusRef.current) {
        setSpinner(statusRef.current);
      } else {
        const p = pickSpinner(Date.now() - started, seriousRef.current, funUsed, prev);
        if (p.isFun) funUsed = true;
        prev = p.text;
        setSpinner(p.text);
      }
      timer = setTimeout(tick, nextInterval());
    };
    timer = setTimeout(tick, FIRST_HOLD_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: body }];
    setMessages(next);
    setInput("");
    setBusy(true);
    statusRef.current = null;
    try {
      const res = await fetch("/api/portal/yuki/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1).slice(-30) }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no_stream");
      const decoder = new TextDecoder();
      let buf = "";
      let got = 0;
      let failed: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s) continue;
          try {
            const ev = JSON.parse(s) as {
              type?: string;
              text?: string;
              error?: string;
              label?: string;
              serious?: boolean;
            };
            if (ev.type === "msg" && ev.text) {
              got += 1;
              setMessages((cur) => [...cur, { role: "assistant", content: ev.text as string }]);
            } else if (ev.type === "status") {
              if (ev.serious) seriousRef.current = true;
              if (ev.label) {
                statusRef.current = ev.label;
                setSpinner(ev.label);
              }
            } else if (ev.type === "error") {
              failed = ev.error ?? null;
            }
          } catch {
            /* 壊れた行は捨てる */
          }
        }
      }
      if (failed && got) {
        setMessages((cur) => [
          ...cur,
          { role: "assistant", content: "すみません、途中で通信が切れてしまいました🙏 もう一度お送りいただけますか?" },
        ]);
      } else if (!got) {
        setError(failed && failed.length < 120 ? failed : "送信に失敗しました。時間をおいてお試しください。");
      }
    } catch {
      setError("通信に失敗しました。電波の良いところでお試しください。");
    } finally {
      setBusy(false);
    }
  }

  const fresh = messages.length <= 1;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-lg font-black text-white">
          ユ
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#222]">
            {clientName ? `${clientName}さま専任 ` : ""}AI担当 ユキ
          </p>
          <p className="text-xs text-[#888]">調べ物・書類・SNSのご相談を承ります</p>
        </div>
        <a href="/portal" className="ml-auto shrink-0 text-xs text-[#999] underline">
          マイページ
        </a>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500 px-4 py-2.5 text-sm leading-relaxed text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-2.5 text-sm leading-relaxed text-[#222]"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* 用途チップ(最初だけ) */}
        {fresh && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="rounded-full border border-[#f7931e]/40 bg-[#fff8f0] px-3 py-1.5 text-xs font-bold text-[#c96a00]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-2.5 text-sm text-[#888]">
              {spinner}…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs font-bold text-red-500">{error}</p>}

      <div className="flex items-end gap-2 border-t border-black/5 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="ご相談・ご依頼を入力"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
        />
        <button
          onClick={() => void send(input)}
          disabled={busy || !input.trim()}
          className="h-[44px] shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          送信
        </button>
      </div>
    </div>
  );
}
