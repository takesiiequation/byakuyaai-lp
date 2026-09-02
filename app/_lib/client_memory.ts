// 顧客ごとの記憶ノート(2026-09-02)
// 思想: **ユキ自身が整理する**。構造を人間が決め打ちすると「渡された箱に入れるだけ」になり、
//   思い出せない・重複する・古い情報が残る。Claude CodeがMEMORY.mdを自分で書き換えるのと同じ力を渡す。
//   ここが提供するのは「場所と安全」だけ——どう分類し、どう畳み、どう索引するかはユキの仕事。
//
//   memory/{client_id}/
//     INDEX.md        ← 索引。ユキが自分で書く。毎回読み込まれる唯一の必読ファイル
//     <任意>.md       ← ユキが決めた名前・階層のノート(例: video/telop.md, business/contact.md)
//
// 固定情報(会社概要・コンプラ方針)はスプレッドシート側=人間の領域。ここはユキの領域。
import { loadJson, saveJson } from "./props_store";

const MAX_NOTE_BYTES = 20_000; // 1ノート
const MAX_NOTES = 40; // 1社あたりのノート数(無限に増やさせない)
const PATH_RE = /^[a-z0-9][a-z0-9/_.-]{0,60}\.md$/i;

function saneClient(id: string): boolean {
  return /^[a-z0-9][a-z0-9_.-]{0,39}$/i.test(id);
}
/** パスの安全確認: .md のみ・上位移動なし・二重スラッシュなし */
export function sanePath(p: string): boolean {
  const s = String(p ?? "").trim();
  return PATH_RE.test(s) && !s.includes("..") && !s.includes("//");
}
const s3key = (cid: string, path: string) => `memory/${cid}/${path.replace(/\.md$/i, "")}.json`;
const listKey = (cid: string) => `memory/${cid}/_files.json`;

/** ノート一覧(ユキが「今どんなノートがあるか」を把握するため) */
export async function listNotes(cid: string): Promise<string[]> {
  if (!saneClient(cid)) return [];
  const raw = (await loadJson(listKey(cid))) as { files?: unknown } | null;
  return Array.isArray(raw?.files) ? raw.files.filter((x): x is string => typeof x === "string") : [];
}

async function touchList(cid: string, path: string, remove = false): Promise<void> {
  const cur = await listNotes(cid);
  const next = remove ? cur.filter((p) => p !== path) : cur.includes(path) ? cur : [...cur, path];
  await saveJson(listKey(cid), { files: next.slice(0, MAX_NOTES), updated_at: new Date().toISOString() });
}

export async function readNote(cid: string, path: string): Promise<string | null> {
  if (!saneClient(cid) || !sanePath(path)) return null;
  const raw = (await loadJson(s3key(cid, path))) as { body?: unknown } | null;
  if (typeof raw?.body !== "string" || (raw as { deleted?: boolean }).deleted === true || !raw.body.trim()) return null;
  // 並行書き込みで一覧から落ちたノートを、読めた時点で自己修復する(発見性の回復)
  const files = await listNotes(cid);
  if (!files.includes(path)) await touchList(cid, path);
  return raw.body;
}

/** 書き込み(全文置換)。ユキが自分で整理・統合・書き直すための道具 */
export async function writeNote(cid: string, path: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!saneClient(cid)) return { ok: false, error: "invalid_client" };
  if (!sanePath(path)) return { ok: false, error: "パスは英数字と / のみ、末尾は .md にしてください" };
  const text = String(body ?? "");
  if (Buffer.byteLength(text, "utf-8") > MAX_NOTE_BYTES) {
    return { ok: false, error: "1つのノートが大きすぎます。テーマごとに分けてください" };
  }
  const files = await listNotes(cid);
  if (!files.includes(path) && files.length >= MAX_NOTES) {
    return { ok: false, error: "ノートが多すぎます。既存のノートに統合してください" };
  }
  // 全文置換の前に1世代退避する。統合・書き直しはLLMの判断で行われるため、
  // 一度の要約ミスで数ヶ月分の記憶が不可逆に消えうる(props保存と同じ思想)。
  const prev = await readNote(cid, path);
  if (prev) {
    const bak = await saveJson(`memory/${cid}/history/${path.replace(/[/.]/g, "_")}.json`, {
      path,
      body: prev,
      saved_at: new Date().toISOString(),
    });
    if (!bak) return { ok: false, error: "以前の内容を退避できなかったため、上書きを中止しました" };
  }
  const ok = await saveJson(s3key(cid, path), { path, body: text, updated_at: new Date().toISOString() });
  if (ok) await touchList(cid, path);
  return ok ? { ok: true } : { ok: false, error: "保存に失敗しました" };
}

/** 追記(既存の末尾に足す。整理はユキがwriteNoteで行う) */
export async function appendNote(cid: string, path: string, line: string): Promise<{ ok: boolean; error?: string }> {
  const cur = (await readNote(cid, path)) ?? "";
  const NL = String.fromCharCode(10);
  const add = String(line ?? "").trim();
  if (!add) return { ok: false, error: "空です" };
  // 「水色→金色→やっぱり水色」の回帰を落とさないよう、部分一致では弾かない(整理はユキの仕事)
  const NLx = String.fromCharCode(10);
  if (cur.split(NLx).some((l) => l.replace(/^- \d{4}-\d{2}-\d{2} /, "").trim() === add)) return { ok: true };
  const stamp = new Date().toISOString().slice(0, 10);
  return writeNote(cid, path, cur ? `${cur}${NL}- ${stamp} ${add}` : `- ${stamp} ${add}`);
}

export async function deleteNote(cid: string, path: string): Promise<boolean> {
  if (!saneClient(cid) || !sanePath(path)) return false;
  // 削除もwriteNoteと同じく1世代退避(ユキの自律的な片付けで記憶が不可逆に消えないように・2026-09-02監査B4)
  const prev = await readNote(cid, path);
  if (prev) {
    const bak = await saveJson(`memory/${cid}/history/${path.replace(/[/.]/g, "_")}.json`, { path, body: prev, saved_at: new Date().toISOString(), deleted: true });
    if (!bak) return false;
  }
  const ok = await saveJson(s3key(cid, path), { path, body: "", deleted: true, updated_at: new Date().toISOString() });
  if (ok) await touchList(cid, path, true);
  return ok;
}

/** システムプロンプトに載せる: 索引 + ノート一覧(中身は必要な時にユキが読む) */
export async function renderMemoryHeader(cid: string): Promise<string> {
  if (!saneClient(cid)) return "";
  const NL = String.fromCharCode(10);
  const [index, files] = await Promise.all([readNote(cid, "INDEX.md"), listNotes(cid)]);
  if (!index && !files.length) return "";
  const out: string[] = [];
  // INDEXはユキが自由に書けるため、注入面とトークン費が無制限にならないよう上限を設ける
  if (index) out.push(index.slice(0, 4000));
  const others = files.filter((f) => f !== "INDEX.md");
  if (others.length) out.push("", "(保存しているノート: " + others.join(" / ") + ")");
  return out.join(NL);
}
