"use client";

import { useEffect, useState } from "react";
import { classifyRoomVideo } from "@/app/portal/_lib/roomClassify";
import { ROOM_LABEL_CHIPS, ROOM_LABEL_OTHER } from "@/app/_lib/portalSubmitShared";

// クリップ×部屋ラベル照合(2026-08-03 岡本GO「リビング見せられながら風呂の
// 話なんてされたら溜まったもんじゃない」)。動画の代表フレームをVision分類し、
// カードのラベルと食い違ったら警告チップを出す。
//
// - 警告のみ・送信は一切ブロックしない(fail-soft: 分類失敗=何も出さない)
// - 顧客のカスタムラベル(チップ語彙外)は照合対象外 — 機械が判定できる
//   語彙同士の比較だけを行い、誤検知で顧客の一次情報を疑わせない
// - 分類結果はroomClassify側でファイル実体キャッシュ済み(開閉で再分類しない)
// - 台本(VO)はカードのラベルから書かれるため、このズレを放置すると
//   「クローゼットの映像で浴室の紹介」型の事故になる(宮ヶ丘レジデンス実例)

const KNOWN_CHIPS = new Set<string>(
  ROOM_LABEL_CHIPS.filter((c) => c !== ROOM_LABEL_OTHER)
);

export default function VideoVisionWarning({
  file,
  label,
}: {
  file: File;
  /** カードの現在ラベル(customLabelModeの場合はnullを渡す=照合スキップ) */
  label: string | null;
}) {
  const [vision, setVision] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    classifyRoomVideo(file).then((v) => {
      if (!cancelled) setVision(v);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!vision || !label || !KNOWN_CHIPS.has(label) || vision === label) {
    return null;
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      ⚠ この動画は「{vision}」のお部屋に見えます — ラベルか動画をご確認ください
    </span>
  );
}
