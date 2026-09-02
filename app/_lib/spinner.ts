// ユキのスピナー(待ち時間の語・2026-09-02)
// Claude CodeのspinnerVerbs(185語・ユーモアを混ぜて長時間作業の単調さを和らげる)に倣う。
// 設計: docs/yuki_desk_ui_design.md §5
//   第1層 道具連動(サーバ発) ← 実作業を言う。常に最優先
//   第2層 地の語ローテーション ← サーバが無言の間クライアントで回す
//   第3層 ユーモア語          ← 待機8秒以降・抽選15%・1回の待機で最大1語
// 深刻な場面(解約・クレーム・謝罪)ではユーモアを完全停止する。

/** 地の語。calm=true は深刻モードでも使える落ち着いた語 */
export const SPINNER_BASE: { text: string; calm: boolean }[] = [
  { text: "考えています", calm: true },
  { text: "確認しています", calm: true },
  { text: "調べています", calm: true },
  { text: "整理しています", calm: true },
  { text: "まとめています", calm: true },
  { text: "読み込んでいます", calm: true },
  { text: "見直しています", calm: true },
  { text: "もう一度確かめています", calm: true },
  { text: "順番に確認しています", calm: true },
  { text: "言葉を選んでいます", calm: true },
  { text: "文面を整えています", calm: true },
  { text: "数字を確かめています", calm: true },
  { text: "過去のやり取りをたどっています", calm: true },
  { text: "見落としがないか見ています", calm: true },
  { text: "裏付けを取っています", calm: true },
  { text: "段取りを考えています", calm: true },
  { text: "要点を拾っています", calm: false },
  { text: "頭の中で組み立てています", calm: false },
  { text: "大事なところに印をつけています", calm: false },
  { text: "下書きを書いています", calm: false },
  { text: "資料をめくっています", calm: false },
  { text: "ノートを開いています", calm: false },
  { text: "メモを取っています", calm: false },
  { text: "ふせんを貼っています", calm: false },
  { text: "机に資料を広げています", calm: false },
  { text: "ぴったりの言い方を探しています", calm: false },
  { text: "答え合わせをしています", calm: false },
  { text: "候補を並べています", calm: false },
  { text: "いいところを探しています", calm: false },
  { text: "一つずつ片付けています", calm: false },
  { text: "先にざっと目を通しています", calm: false },
  { text: "大事な数字を書き写しています", calm: false },
  { text: "話の流れを思い出しています", calm: false },
  { text: "結論から書き始めています", calm: false },
  { text: "表にまとめています", calm: false },
  { text: "指差し確認しています", calm: false },
];

/** ユーモア語(16語・岡本確定)。深刻モードでは一切出さない。
 *  選定基準=一生懸命な新人の可愛い挙動のみ。サボり・眠り・脱線に見える語は不採用。 */
export const SPINNER_FUN: string[] = [
  "コーヒーを淹れています",
  "ポンデリングを食べています",
  "お茶を一口飲んでいます",
  "腕まくりしています",
  "深呼吸しています",
  "背筋を伸ばしています",
  "めがねを拭いています",
  "気合いを入れています",
  "先輩のノートをこっそり見ています",
  "ペン回しに失敗しました",
  "電卓を叩いています",
  "ペンをくわえて考えています",
  "資料の山から掘り出しています",
  "コーヒーをおかわりしています",
  "頭をフル回転させています",
  "ノートに図を描いています",
];

/** 道具連動の表示(第1層)。サーバが道具実行の直前に送る */
export const TOOL_STATUS: Record<string, string> = {
  read_memory: "ノートを読み返しています",
  write_memory: "ノートを整理しています",
  delete_memory_note: "ノートを整理しています",
  update_client_memory: "ノートに書き留めています",
  get_video_info: "動画の今の状態を確認しています",
  get_video_details: "動画の設計を確認しています",
  submit_text_edits: "修正を提出しています",
  submit_caption_edit: "投稿文の修正を提出しています",
  request_scene_swap: "差し替えを手配しています",
  set_narration_speed: "読み上げの設定を変えています",
  set_telop_color: "テロップの色を変えています",
  set_scene_duration: "シーンの長さを調整しています",
  request_human_support: "担当者に申し送りを書いています",
  search_documents: "資料棚を探しています",
  read_document: "資料を読んでいます",
  list_documents: "資料の一覧を見ています",
  create_output: "清書しています",
  fill_template: "書式に書き込んでいます",
};

/** 深刻さの判定に使う語(いずれか一致で serious)。迷ったら深刻側に倒す。 */
const SERIOUS_WORDS = [
  "解約", "クレーム", "苦情", "怒", "謝罪", "おかしい", "困って", "トラブル",
  "事故", "至急", "大至急", "返金", "請求", "契約", "弁護士", "法律",
  "景品表示", "間違い", "ミス", "失礼", "不満", "ひどい", "最悪",
];

export function isSerious(recentUserTexts: string[]): boolean {
  return recentUserTexts.slice(-3).some((t) => SERIOUS_WORDS.some((w) => t.includes(w)));
}

const FUN_RATE = 0.15; // 抽選でユーモアが選ばれる確率
const FUN_AFTER_MS = 8000; // これ以前はユーモアを出さない

/** 次に表示する語を選ぶ(クライアント側で使う)
 *  @param elapsedMs 待機開始からの経過
 *  @param serious   深刻モード
 *  @param funUsed   この待機で既にユーモアを使ったか(1回まで)
 *  @param prev      直前の語(同じ語の連続を避ける) */
export function pickSpinner(
  elapsedMs: number,
  serious: boolean,
  funUsed: boolean,
  prev?: string,
): { text: string; isFun: boolean } {
  const canFun = !serious && !funUsed && elapsedMs >= FUN_AFTER_MS;
  if (canFun && Math.random() < FUN_RATE) {
    const pool = SPINNER_FUN.filter((t) => t !== prev);
    return { text: pool[Math.floor(Math.random() * pool.length)], isFun: true };
  }
  const pool = SPINNER_BASE.filter((b) => (serious ? b.calm : true)).filter((b) => b.text !== prev);
  return { text: pool[Math.floor(Math.random() * pool.length)].text, isFun: false };
}

/** 切替間隔(4〜6秒ランダム。等間隔は機械的に見える) */
export const nextInterval = (): number => 4000 + Math.floor(Math.random() * 2000);
/** 最初の数秒は固定文言(短い待ちでチカチカさせない) */
export const FIRST_LABEL = "ユキが考えています";
export const FIRST_HOLD_MS = 3000;
