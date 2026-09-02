"use client";

import { useEffect, useRef, useState } from "react";
import { pickSpinner, nextInterval, FIRST_LABEL, FIRST_HOLD_MS } from "@/app/_lib/spinner";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function greeting(clientName: string, propertyName: string): string {
  const who = clientName ? `${clientName}さま専任の` : "";
  const what = propertyName ? `「${propertyName}」の動画について、` : "この動画について、";
  return `こんにちは、ByakuyaAIの${who}AI編集担当 ユキです😊\n${what}テロップやナレーションの文言修正・ご質問を承ります。\n「◯◯のテロップを△△に直したい」のように、お気軽にお送りください。`;
}

export default function CompanionChat({
  approvalId,
  clientName,
  propertyName,
}: {
  approvalId: string;
  clientName: string;
  propertyName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: greeting(clientName, propertyName) },
  ]);
  // 過去の会話を復元(チャットを離れても続きから話せる)
  useEffect(() => {
    let alive = true;
    fetch(`/api/companion/history?approvalId=${encodeURIComponent(approvalId)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; messages?: Msg[] }) => {
        if (alive && d.ok && d.messages && d.messages.length > 0) {
          setMessages([
            { role: "assistant", content: greeting(clientName, propertyName) },
            ...d.messages,
          ]);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // 待機表示(スピナー): 道具連動のstatusが来ればそれを出し、無言の間は地の語を回す
  const [spinner, setSpinner] = useState(FIRST_LABEL);
  const seriousRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // 待機中の語を回す。最初の3秒は固定→以降4〜6秒ごと。
  // 道具のstatusが来ている間はそれを優先(実作業の報告が常に勝つ)。
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    let funUsed = false;
    let prev = FIRST_LABEL;
    setSpinner(FIRST_LABEL);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const elapsed = Date.now() - started;
      if (statusRef.current) {
        setSpinner(statusRef.current);
      } else {
        const p = pickSpinner(elapsed, seriousRef.current, funUsed, prev);
        if (p.isFun) funUsed = true;
        prev = p.text;
        setSpinner(p.text);
      }
      timer = setTimeout(tick, nextInterval());
    };
    timer = setTimeout(tick, FIRST_HOLD_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    statusRef.current = null;
    try {
      const res = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId,
          // 挨拶(固定文)はAPIに送らない
          messages: next.slice(1).slice(-30),
        }),
      });
      // 逐次受信(NDJSON): ユキが「確認しますね」→作業→「できました」と
      // 話しながら進む様子をそのまま吹き出しに反映する。
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
            const ev = JSON.parse(s) as { type?: string; text?: string; error?: string; label?: string; serious?: boolean };
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
            /* 壊れた行は捨てる(次の行で復帰できる) */
          }
        }
      }
      if (failed && got) {
        // 前置きだけ出た後に落ちると、画面が「確認しますね」で止まって無言になる
        setMessages((cur) => [
          ...cur,
          { role: "assistant", content: "すみません、途中で通信が切れてしまいました🙏 もう一度お送りいただけますか?" },
        ]);
      } else if (!got) {
        setError(
          failed && failed.length < 120
            ? failed
            : "送信に失敗しました。時間をおいてお試しください。"
        );
      }
    } catch {
      setError("通信に失敗しました。電波の良いところでお試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-lg font-black text-white">
          ユ
        </div>
        <div>
          <p className="text-sm font-black text-[#222]">
            {clientName ? `${clientName}さま専任 ` : ""}AI編集担当 ユキ
          </p>
          <p className="text-xs text-[#888]">この動画の修正・ご質問を承ります</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
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
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[#f4f2ee] px-4 py-2.5 text-sm text-[#888]">
              {spinner}…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 pb-1 text-xs font-bold text-red-500">{error}</p>
      )}

      <div className="flex items-end gap-2 border-t border-black/5 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="修正のご希望・ご質問を入力"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="h-[44px] shrink-0 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          送信
        </button>
      </div>
    </div>
  );
}
