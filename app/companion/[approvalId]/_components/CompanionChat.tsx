"use client";

import { useEffect, useRef, useState } from "react";

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
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
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
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      };
      if (data.ok && data.reply) {
        setMessages((cur) => [...cur, { role: "assistant", content: data.reply as string }]);
      } else {
        setError(
          data.error && data.error.length < 120
            ? data.error
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
              ユキが確認しています…
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
          maxLength={1000}
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
