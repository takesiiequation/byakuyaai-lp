export type Food = { id: string; n: string; p: number; u: string };
export type Check = { id: string; n: string; pt: number; neg?: boolean };
export type Exercise = { id: string; n: string; kg: number; r: number; s: number };
export type Part = { id: string; n: string; c: string; ex: Exercise[] };

export const TGT = 104;
export const MAX = 130;

export const FOODS: Food[] = [
  { id: "egg", n: "ゆで卵", p: 6, u: "個" },
  { id: "banana", n: "バナナ", p: 1, u: "本" },
  { id: "lunch", n: "Aランチ", p: 25, u: "食" },
  { id: "momo", n: "鶏もも", p: 40, u: "食" },
  { id: "sake", n: "塩鮭", p: 18, u: "切" },
  { id: "natto", n: "納豆", p: 7, u: "P" },
  { id: "yaki", n: "焼鳥", p: 7, u: "本" },
  { id: "schk", n: "サラダチキン", p: 22, u: "個" },
  { id: "prot", n: "プロテイン", p: 24, u: "杯" },
  { id: "rice", n: "ご飯", p: 4, u: "杯" },
  { id: "tkg", n: "卵かけご飯", p: 10, u: "杯" },
  { id: "broc", n: "ブロッコリー", p: 4, u: "皿" },
  { id: "avo", n: "アボカド", p: 2, u: "個" },
  { id: "nuts", n: "ナッツ", p: 5, u: "掴" },
  { id: "yog", n: "ヨーグルト", p: 5, u: "皿" },
  { id: "ramen", n: "ラーメン", p: 25, u: "杯" },
  { id: "sushi", n: "回転寿司", p: 35, u: "回" },
];

export const CHECKS: Check[] = [
  { id: "asa", n: "朝食", pt: 10 },
  { id: "veg", n: "野菜", pt: 10 },
  { id: "supp", n: "サプリ5種", pt: 10 },
  { id: "crea", n: "クレアチン", pt: 5 },
  { id: "fry", n: "揚げ物・皮", pt: -10, neg: true },
];

export const PARTS: Part[] = [
  {
    id: "chest", n: "胸", c: "--c1",
    ex: [
      { id: "bench", n: "ベンチプレス", kg: 70, r: 8, s: 4 },
      { id: "incbench", n: "インクラインベンチプレス", kg: 50, r: 10, s: 3 },
      { id: "peck", n: "ペックデッキフライマシン", kg: 55, r: 15, s: 3 },
      { id: "cross", n: "ケーブルクロスオーバー", kg: 12.5, r: 20, s: 3 },
    ],
  },
  {
    id: "shoulder", n: "肩", c: "--c2",
    ex: [
      { id: "arnold", n: "アーノルドプレス", kg: 22, r: 10, s: 3 },
      { id: "cablelat", n: "ワンハンドケーブルサイドレイズ", kg: 8, r: 20, s: 3 },
      { id: "rear", n: "サイドライイングリアレイズ", kg: 7, r: 15, s: 3 },
      { id: "front", n: "ダンベルフロントレイズ", kg: 10, r: 15, s: 2 },
    ],
  },
  {
    id: "arm", n: "腕", c: "--c3",
    ex: [
      { id: "ez", n: "EZバーカール", kg: 20, r: 20, s: 3 },
      { id: "pressdown", n: "ケーブルプレスダウン", kg: 25, r: 20, s: 3 },
    ],
  },
  {
    id: "back", n: "背中", c: "--c4",
    ex: [
      { id: "lat", n: "ラットプルダウン", kg: 42.5, r: 15, s: 4 },
      { id: "highrow", n: "ハイローマシン", kg: 70, r: 10, s: 4 },
      { id: "seatrow", n: "シーテッドロウマシン", kg: 57.5, r: 10, s: 3 },
    ],
  },
  { id: "rest", n: "休養", c: "", ex: [] },
];

export const EXMAP: Record<string, Exercise & { part: string }> = {};
for (const p of PARTS) for (const e of p.ex) EXMAP[e.id] = { ...e, part: p.id };

/** 月=胸 火=肩 水=腕 木=背中 */
export const PLAN: Record<number, string> = { 1: "chest", 2: "shoulder", 3: "arm", 4: "back" };

/** Offline fallback for the free-text estimator. The server route (Gemini)
 * is tried first; this table answers when the key is unset or the call
 * fails, so the field is never dead. Values are protein g per serving. */
export const EST: [string, number][] = [
  ["カツカレー", 35], ["カレー", 15], ["牛丼", 20], ["親子丼", 25], ["カツ丼", 30],
  ["天丼", 15], ["チャーハン", 15], ["オムライス", 20], ["ハンバーグ", 20],
  ["とんかつ", 25], ["生姜焼き", 25], ["唐揚げ", 20], ["餃子", 12], ["焼肉", 35],
  ["ステーキ", 30], ["すき焼き", 30], ["しゃぶしゃぶ", 30], ["刺身", 20],
  ["焼き魚", 18], ["さば", 20], ["まぐろ", 22], ["うどん", 10], ["そば", 12],
  ["パスタ", 15], ["ピザ", 20], ["サンドイッチ", 12], ["おにぎり", 4],
  ["弁当", 25], ["定食", 30], ["豆腐", 10], ["味噌汁", 3], ["チーズ", 4],
  ["牛乳", 7], ["プロテインバー", 15], ["シチュー", 15], ["グラタン", 18],
  ["春巻き", 6], ["麻婆豆腐", 18], ["回鍋肉", 20], ["エビフライ", 8],
  ["コロッケ", 5], ["天ぷら", 10], ["寿司", 25],
];

export function guessLocal(name: string): number | null {
  const s = (name || "").trim();
  if (!s) return null;
  for (const [k, v] of EST) if (s.includes(k)) return v;
  for (const f of FOODS) if (s.includes(f.n)) return f.p;
  return null;
}
