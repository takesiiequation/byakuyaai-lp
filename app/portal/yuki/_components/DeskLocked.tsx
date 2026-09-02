// ユキのデスク・案内画面(プレミアム未開放の顧客に見せる)
// 設計方針(Fable): FeatureLockCardのグレーアウトは使わない。
//   「商品を薄暗くして売る店はない」——冒頭でプレミアム限定と明示した上で、
//   以降は価値の話だけをする。ユキ本人はフルカラーで見せる。
"use client";

import { useState } from "react";

export default function DeskLocked({ clientName }: { clientName: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function askForInfo() {
    if (sending || sent) return;
    setSending(true);
    try {
      await fetch("/api/portal/yuki/interest", { method: "POST" });
      setSent(true);
    } catch {
      setSent(true); // 通知の失敗を顧客の画面には出さない(担当者側で拾う)
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-2xl font-black text-white">
          ユ
        </div>
        <h1 className="mt-3 text-lg font-black text-[#222]">専任AI担当 ユキのデスク</h1>
        <p className="mt-1 text-xs font-bold text-[#f7931e]">プレミアムプランの機能です</p>

        <p className="mt-4 text-left text-sm leading-relaxed text-[#444]">
          ユキは{clientName ? `${clientName}さま` : "御社"}のことを覚えている「専任のAI担当」です。
          動画の修正だけでなく、日々のご相談にもお応えします。
        </p>

        <ul className="mt-4 space-y-2 text-left text-sm text-[#444]">
          {[
            "御社の好み・決まりごとを覚えていて、相談のたびに思い出します",
            "物件の紹介文・SNSの投稿文を一緒に考えられます",
            "（近日）資料をお預けいただくと、調べ物や書類づくりもお任せいただけます",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[#f7931e]">●</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {/* 会話サンプル(静止モック): 「記憶がある」ことが一目で伝わる例を選ぶ */}
        <div className="mt-5 space-y-2 rounded-xl bg-[#faf9f7] p-3 text-left">
          <p className="text-[10px] font-bold text-[#999]">会話のイメージ</p>
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-orange-500 px-3 py-2 text-xs text-white">
              前に決めたテロップの色って何だっけ?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#f4f2ee] px-3 py-2 text-xs text-[#222]">
              水色です!8月のご相談で「爽やかに見せたい」とのことで決めましたね😊
              今回もその色で進めますか?
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm text-[#444]">ご興味があればお気軽にご相談ください。</p>
        <button
          onClick={() => void askForInfo()}
          disabled={sending || sent}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#f7931e] to-[#ffb347] py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
        >
          {sent ? "担当者にお伝えしました ✓" : sending ? "送信中…" : "話を聞いてみる"}
        </button>
      </div>

      <p className="text-center text-xs text-[#999]">
        <a href="/portal" className="underline">
          マイページに戻る
        </a>
      </p>
    </div>
  );
}
