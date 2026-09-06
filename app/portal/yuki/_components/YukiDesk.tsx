// ユキのデスク(R2.5: デスクユキ=Fargateランタイム・Claude Codeらしい作業ログ・スレッド・ノート)
// 設計: fudosan-video/docs/yuki_desk_ui_design.md §2〜§6
//   相談(スレッド一覧→チャット) / ノート(記憶の閲覧・読み取り専用)。モバイル=セグメント、PC=2ペイン。
//   通信: POST /api/portal/yuki/run {prompt, thread_id?, paid_grant?} → job_id,thread_id → GET /api/portal/yuki/job をポーリング
//   復元: 進行中ジョブは localStorage に控え、画面を開き直しても続きから描く
//   意匠(2026-09-06 岡本レビュー): アイコン+名前は付けない / 色はオレンジのまま・水色は「縁」だけ / 背景は無地 / 吹き出しは紙の質感 /
//         作業カードはタイムライン(絵柄+経過秒) / 最初の画面は「ようこそ」 / 一覧に話題の絵柄と相対時刻 / ノートは手帳風 / 動きは控えめ
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickSpinner, nextInterval, FIRST_LABEL, FIRST_HOLD_MS } from "@/app/_lib/spinner";
import LiteMd from "@/app/_lib/lite_md";

type Part = { kind: "text"; text: string } | { kind: "step"; label: string; done: boolean; failed?: boolean; startedAt: number; endedAt?: number } | { kind: "image"; key: string; alt: string };
interface Msg { role: "user" | "assistant"; content: string; parts?: Part[]; live?: boolean; }
interface Attachment { key: string; name: string; preview: string; }
const imgUrl = (key: string) => `/api/portal/yuki/image?key=${encodeURIComponent(key)}`;
const IMG_KEY = /^images\/(in|out)\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/;
/** お客様の吹き出し: 「添付画像: images/in/…」の行は文字でなくサムネで見せる */
const splitUser = (content: string) => {
  const images: string[] = []; const lines: string[] = [];
  for (const l of content.split("\n")) { const m = /^添付画像:\s*(images\/in\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp))\s*$/.exec(l.trim()); if (m) images.push(m[1]); else lines.push(l); }
  return { text: lines.join("\n").trim(), images };
};
/** 添付前に長辺1600pxへ縮める(通信量と本文上限4.5MBの内側に収める)。縮められない環境では元のまま */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600; const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (s >= 1 && file.size < 1_500_000) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const png = file.type === "image/png";
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), png ? "image/png" : "image/jpeg", 0.9));
  } catch { return file; }
}
interface Proposal { tool: string; args_hash: string; cost_label: string; }
interface CreditsView { stage: string; pct10: number; exhausted: boolean; }
interface ThreadMeta { id: string; title: string; archived: boolean; updated_at: string; last_preview: string; }
interface NoteMeta { path: string; size: number; updated_at: string; }

const STARTERS = ["動画の設計図を検査してほしい", "物件の紹介文を一緒に考えたい", "SNS用の画像を作ってほしい", "うちの会社のことを覚えてもらう", "その他なんでも"];
const TOOL_LABEL: Record<string, string> = {
  mcp__byakuyaai__memory_list: "記憶ノートの索引を確認", mcp__byakuyaai__memory_read: "記憶ノートを読む", mcp__byakuyaai__memory_write: "記憶ノートを整理",
  mcp__byakuyaai__video_list: "動画の一覧を確認", mcp__byakuyaai__video_info: "設計図を読む",
  mcp__byakuyaai__layout_lint: "レイアウトを検査", mcp__byakuyaai__props_lint: "設計図を検査",
  mcp__byakuyaai__credits_balance: "今月の稼働を確認", mcp__byakuyaai__render_lambda: "動画を仕上げ直す(数分)",
  mcp__byakuyaai__seedance_regenerate: "映像を作り直す", mcp__byakuyaai__human_support: "担当者に申し送り",
  mcp__byakuyaai__image_list: "画像の一覧を確認", mcp__byakuyaai__image_generate: "画像を生成(1分ほど)", mcp__byakuyaai__image_edit: "画像を加工(1分ほど)",
  Read: "机の上の資料を確認", Write: "資料を書く", Edit: "設計図を直す", Glob: "机の上を探す", Grep: "机の上を探す",
};
const labelOf = (name: string) => TOOL_LABEL[name] || (name.startsWith("mcp__byakuyaai__") ? "作業中" : "机の上を確認");
/** 作業カードの絵柄(話題で決める) */
const stepIcon = (label: string) => /画像/.test(label) ? "🎨" : /検査/.test(label) ? "🔍" : /記憶|ノート/.test(label) ? "📝" : /仕上げ|映像/.test(label) ? "🎬" : /担当者/.test(label) ? "🤝" : /稼働/.test(label) ? "⏱" : /設計図/.test(label) ? "📐" : /一覧/.test(label) ? "🗂" : "📄";
const threadIcon = (t: ThreadMeta) => { const s = t.title + " " + t.last_preview; return /覚え|記憶|決まり|ルール|ノート/.test(s) ? "📝" : /画像|サムネ|バナー|写真/.test(s) ? "🎨" : /紹介文|SNS|投稿|反響|ハッシュタグ/.test(s) ? "✍️" : /動画|設計図|テロップ|レンダー|検査|APR-/.test(s) ? "🎬" : "💬"; };
const POLL_MS = 1500;
const LS_KEY = "yuki_desk_active_job";
/** 相対時刻(3分前・昨日・9/5) */
const fmtRel = (iso: string) => {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime(); const m = Math.floor(diff / 60000);
  if (m < 1) return "いま"; if (m < 60) return `${m}分前`; const h = Math.floor(m / 60); if (h < 24) return `${h}時間前`;
  const days = Math.floor(h / 24); if (days === 1) return "昨日"; if (days < 7) return `${days}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const fmtSec = (ms: number) => (ms < 1000 ? "" : ms < 60000 ? `${Math.round(ms / 1000)}秒` : `${Math.floor(ms / 60000)}分${Math.round((ms % 60000) / 1000)}秒`);

const STYLE = `
@keyframes yukiIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes yukiPop { 0% { transform: scale(.6); opacity: .4; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); } }
@keyframes yukiDot { 0%, 80%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-3px); opacity: 1; } }
.yuki-in { animation: yukiIn .28s ease-out both; }
.yuki-pop { animation: yukiPop .45s ease-out both; }
.yuki-dot { display:inline-block; width:5px; height:5px; border-radius:9999px; background:#c96a00; animation: yukiDot 1.2s infinite ease-in-out; }
.yuki-dot:nth-child(2) { animation-delay: .15s } .yuki-dot:nth-child(3) { animation-delay: .3s }
.yuki-paper { background: #fbf8f2; box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 6px 16px -12px rgba(120, 80, 20, .25); }
`;

function CreditsBar({ c }: { c: CreditsView | null }) {
  // 残りを濃い水色、使った分(枯渇分)をグレーで。残りが2割を切ったら残りをオレンジで注意(岡本 9/6: 濃淡の差が無いと分かりにくい)
  const used = c ? c.pct10 : 0;
  const remainingSeg = 10 - Math.round(used / 10);
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="shrink-0 text-[11px] font-bold text-sky-700">今月のユキクレジット</span>
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={"h-2 flex-1 rounded-sm " + (i < remainingSeg ? (used >= 80 ? "bg-orange-400" : "bg-sky-600") : "bg-gray-300")} />
        ))}
      </div>
      <span className="shrink-0 text-[11px] text-[#666]">{c ? c.stage : "確認中"}</span>
    </div>
  );
}

/** 待機中の表示: スピナー語(3層)+点3つ */
function Thinking({ label }: { label: string }) {
  return (
    <div className="yuki-in flex justify-start">
      <div className="yuki-paper flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-[#777]">
        <span className="flex items-center gap-[3px]"><span className="yuki-dot" /><span className="yuki-dot" /><span className="yuki-dot" /></span>
        <span>{label}…</span>
      </div>
    </div>
  );
}

/** ユキの吹き出し: 発話と作業の1手(ステップ)を時間順に描く。ステップはタイムライン(絵柄+経過秒)。多い時は折りたたむ */
function AssistantBubble({ m }: { m: Msg }) {
  const [open, setOpen] = useState(false);
  const parts = m.parts && m.parts.length ? m.parts : [{ kind: "text", text: m.content } as Part];
  const steps = parts.filter((p) => p.kind === "step").length;
  const collapsible = steps > 4 && !m.live;
  // 連続するステップをひとかたまり(タイムライン)にする。画像はそのまま1枚ずつ
  const groups: Array<{ kind: "text"; text: string } | { kind: "image"; key: string; alt: string } | { kind: "steps"; items: Extract<Part, { kind: "step" }>[] }> = [];
  for (const p of parts) {
    if (p.kind === "text" || p.kind === "image") groups.push(p);
    else { const last = groups[groups.length - 1]; if (last && last.kind === "steps") last.items.push(p); else groups.push({ kind: "steps", items: [p] }); }
  }
  // 本文に同じ画像が ![…](…) で貼られている時は、作業中に出した1枚(live)を二重に見せない
  const inText = (key: string) => m.content.includes(`key=${encodeURIComponent(key)}`);
  return (
    <div className="yuki-paper max-w-[90%] rounded-3xl rounded-bl-lg px-4 py-3 text-sm leading-relaxed text-[#222] lg:max-w-[88%] lg:px-6 lg:py-4 lg:text-[15.5px]">
      {collapsible && (
        <button onClick={() => setOpen((v) => !v)} className="mb-2 flex items-center gap-1 text-xs font-bold text-[#c96a00]">
          <span className={"inline-block transition-transform " + (open ? "rotate-90" : "")}>▶</span> 作業の記録({steps}手){open ? "を閉じる" : "を見る"}
        </button>
      )}
      {groups.map((g, gi) =>
        g.kind === "text" ? (
          g.text.trim() ? <div key={gi} className={gi > 0 ? "mt-2" : ""}><LiteMd text={g.text} /></div> : null
        ) : g.kind === "image" ? (
          inText(g.key) ? null : <a key={gi} href={imgUrl(g.key)} target="_blank" rel="noreferrer" className="yuki-in my-2 block"><img src={imgUrl(g.key)} alt={g.alt} loading="lazy" className="max-h-[360px] max-w-full rounded-xl shadow-sm" /></a>
        ) : (collapsible && !open) ? null : (
          <ol key={gi} className="my-2 ml-1 border-l-2 border-sky-200 pl-3">
            {g.items.map((p, i) => (
              <li key={i} className="relative my-1.5 flex items-center gap-2 text-xs text-[#555]">
                <span className={"absolute -left-[19px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white " + (p.done ? (p.failed ? "bg-red-400" : "bg-emerald-500") : "bg-sky-400")} />
                <span className="rounded-lg border border-sky-100 bg-white/80 px-2 py-1 text-base leading-none">{stepIcon(p.label)}</span>
                <span className="text-[#444]">{p.label}{p.done ? "" : "…"}</span>
                {p.done && p.endedAt && <span className="text-[10px] text-[#aaa]">{fmtSec(p.endedAt - p.startedAt)}</span>}
                {p.done ? <span className={"yuki-pop ml-auto font-black " + (p.failed ? "text-red-500" : "text-emerald-600")}>{p.failed ? "!" : "✓"}</span> : <span className="ml-auto inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />}
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

/** 最初の画面: ようこそ(できること3つ+用途チップ) */
function Welcome({ clientName, onPick }: { clientName: string; onPick: (s: string) => void }) {
  const items = [
    { icon: "🎬", t: "動画の設計図を整える", d: "テロップの文言・順番・尺を見直し、検査してから仕上げ直します" },
    { icon: "🎨", t: "画像づくり", d: "投稿用の画像・サムネ・お預かりした写真の加工。参考画像を添付して雰囲気を伝えられます" },
    { icon: "📝", t: "御社の決まりを覚える", d: "「今後はこうして」と伝えると記憶ノートに書き、次から活かします" },
    { icon: "💬", t: "日々の相談", d: "紹介文づくり・SNSの反響・社内の記録など、何でもどうぞ" },
  ];
  return (
    <div className="yuki-in mx-auto max-w-2xl px-1 pt-2">
      <div className="yuki-paper rounded-3xl px-5 py-4 lg:px-7 lg:py-6">
        <p className="text-[15px] font-black text-[#222] lg:text-lg">{clientName ? `${clientName}さま、` : ""}ようこそ ユキのデスクへ😊</p>
        <p className="mt-1 text-xs text-[#777] lg:text-sm">御社専任のAI担当が、ここで一緒に働きます。今日はどんなご相談でしょうか?</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.t} className="rounded-2xl border border-sky-100 bg-white/70 px-3 py-3">
              <div className="text-xl">{it.icon}</div>
              <p className="mt-1 text-sm font-bold text-[#222]">{it.t}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#777]">{it.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => <button key={s} onClick={() => onPick(s)} className="rounded-full border border-[#f7931e]/40 bg-[#fff8f0] px-3 py-1.5 text-xs font-bold text-[#c96a00] hover:bg-[#ffefdc]">{s}</button>)}
        </div>
      </div>
    </div>
  );
}

/** スレッド一覧(LINEのトーク一覧の形) */
function ThreadList({ threads, currentId, onOpen, onNew, onArchive }: { threads: ThreadMeta[]; currentId: string | null; onOpen: (id: string) => void; onNew: () => void; onArchive: (id: string, archived: boolean) => void }) {
  const [showOld, setShowOld] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const live = threads.filter((t) => !t.archived);
  const old = threads.filter((t) => t.archived);
  const shown = live.slice(0, 10);
  const more = live.slice(10);
  const Row = ({ t }: { t: ThreadMeta }) => (
    <div className={"group flex items-center gap-2.5 rounded-xl px-3 py-2.5 " + (t.id === currentId ? "bg-[#fff3e6]" : "hover:bg-black/[.03]")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-lg">{threadIcon(t)}</span>
      <button onClick={() => onOpen(t.id)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-[#222]">{t.title || "相談"}</span><span className="ml-auto shrink-0 text-[10px] text-[#999]">{fmtRel(t.updated_at)}</span></div>
        <p className="truncate text-xs text-[#888]">{t.last_preview || "…"}</p>
      </button>
      <button onClick={() => onArchive(t.id, !t.archived)} title={t.archived ? "戻す" : "片付ける"} className="shrink-0 rounded-md px-1.5 py-1 text-[11px] text-[#bbb] hover:bg-black/5 hover:text-[#666]">{t.archived ? "戻す" : "片付ける"}</button>
    </div>
  );
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <button onClick={onNew} className={"w-full rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors " + (currentId === null ? "border-orange-400 bg-[#fff8f0] text-[#c96a00]" : "border-dashed border-[#f7931e]/50 text-[#c96a00] hover:bg-[#fff8f0]")}>＋ 新しい相談をはじめる</button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {shown.map((t) => <Row key={t.id} t={t} />)}
        {more.length > 0 && !showMore && <button onClick={() => setShowMore(true)} className="w-full px-3 py-2 text-xs text-[#999]">さらに表示({more.length}件) ▽</button>}
        {showMore && more.map((t) => <Row key={t.id} t={t} />)}
        {old.length > 0 && (
          <div className="mt-2 border-t border-black/5 pt-2">
            <button onClick={() => setShowOld((v) => !v)} className="w-full px-3 py-1.5 text-xs text-[#999]">片付けた相談({old.length}件) {showOld ? "△" : "▽"}</button>
            {showOld && old.map((t) => <Row key={t.id} t={t} />)}
          </div>
        )}
        {live.length === 0 && old.length === 0 && <p className="px-4 py-6 text-center text-xs text-[#999]">まだ相談はありません。「新しい相談をはじめる」からどうぞ</p>}
      </div>
    </div>
  );
}

/** ノート(記憶)の閲覧・読み取り専用・手帳風。書き換えはチャットでユキに頼む(設計書§8-6) */
function NotesPane({ compact, onBack }: { compact: boolean; onBack?: () => void }) {
  const [notes, setNotes] = useState<NoteMeta[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [body, setBody] = useState<string>("");
  useEffect(() => { fetch("/api/portal/yuki/notes").then((r) => r.json()).then((d: { ok?: boolean; notes?: NoteMeta[] }) => setNotes(d.ok ? d.notes ?? [] : [])).catch(() => setNotes([])); }, []);
  const open = (p: string) => { setCurrent(p); setBody(""); fetch(`/api/portal/yuki/notes?path=${encodeURIComponent(p)}`).then((r) => r.json()).then((d: { ok?: boolean; body?: string }) => setBody(d.ok ? d.body ?? "" : "(読めませんでした)")).catch(() => setBody("(読めませんでした)")); };
  const title = (p: string) => (p === "INDEX.md" ? "索引" : p.replace(/\.md$/, "").split("/").pop() || p);
  const group = (p: string) => (p.includes("/") ? p.split("/")[0] : "");
  const list = (
    <div className="h-full overflow-y-auto px-3 py-3">
      <p className="pb-3 text-[11px] leading-relaxed text-[#999]">ユキが御社について覚えていることです。書き換えはチャットでユキに頼んでください</p>
      {notes === null ? <p className="text-xs text-[#999]">読み込んでいます…</p> : notes.length === 0 ? <p className="text-xs text-[#999]">まだノートはありません。相談の中で「覚えて」と伝えると増えていきます</p> :
        <div className="grid gap-2">
          {notes.map((n) => (
            <button key={n.path} onClick={() => open(n.path)} className={"yuki-in relative overflow-hidden rounded-2xl border px-3 py-3 text-left transition-colors " + (current === n.path ? "border-orange-300 bg-[#fff8f0]" : "border-sky-100 bg-white hover:bg-sky-50/40")}>
              <span className="absolute left-0 top-0 h-full w-1.5 bg-sky-200" />
              <div className="flex items-center gap-2 pl-1">
                <span className="text-lg">{n.path === "INDEX.md" ? "📒" : "📄"}</span>
                <span className="truncate text-sm font-bold text-[#222]">{title(n.path)}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[#aaa]">{fmtRel(n.updated_at)}</span>
              </div>
              <p className="mt-0.5 pl-1 text-[11px] text-[#999]">{group(n.path) ? `${group(n.path)} / ` : ""}約{Math.max(1, Math.round(n.size / 3))}字</p>
            </button>
          ))}
        </div>}
    </div>
  );
  const viewer = (
    <div className="h-full overflow-y-auto px-4 py-3 lg:px-6">
      {compact && <button onClick={() => setCurrent(null)} className="mb-2 text-xs text-[#999]">← ノート一覧</button>}
      {current ? (
        <div className="yuki-paper yuki-in rounded-3xl px-5 py-4 text-sm leading-relaxed text-[#222] lg:px-7 lg:py-6">
          <p className="mb-3 text-[11px] text-[#aaa]">📒 {current === "INDEX.md" ? "索引" : current.replace(/\.md$/, "")}</p>
          {body ? <LiteMd text={body} /> : <p className="text-xs text-[#999]">読み込んでいます…</p>}
        </div>
      ) : <p className="text-xs text-[#999]">左の一覧からノートを選んでください</p>}
    </div>
  );
  if (compact) return <div className="flex h-full flex-col">{onBack && !current && <button onClick={onBack} className="px-3 pt-2 text-left text-xs text-[#999]">← 相談へ</button>}<div className="min-h-0 flex-1">{current ? viewer : list}</div></div>;
  return <div className="grid h-full grid-cols-[280px_1fr]"><div className="min-h-0 border-r border-black/5">{list}</div><div className="min-h-0">{viewer}</div></div>;
}

export default function YukiDesk({ clientName }: { clientName: string }) {
  const greeting = `こんにちは、${clientName ? `${clientName}さま専任の` : ""}AI担当 ユキです😊\n今日はどんなご相談でしょうか?`;
  const [tab, setTab] = useState<"chat" | "notes">("chat");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinner, setSpinner] = useState(FIRST_LABEL);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [credits, setCredits] = useState<CreditsView | null>(null);
  const [finishedBanner, setFinishedBanner] = useState(false);
  const seriousRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const threadRef = useRef<string | null>(null);
  threadRef.current = threadId;

  const loadThreads = useCallback(async () => {
    try { const d = (await (await fetch("/api/portal/yuki/threads")).json()) as { ok?: boolean; threads?: ThreadMeta[] }; if (d.ok) setThreads(d.threads ?? []); } catch {}
  }, []);
  const openThread = useCallback(async (id: string | null) => {
    setThreadId(id); setProposal(null); setError(null); setMobileView("chat"); setTab("chat");
    if (!id) { setMessages([]); return; }
    setMessages([{ role: "assistant", content: "読み込んでいます…" }]);
    try {
      const d = (await (await fetch(`/api/portal/yuki/threads?thread_id=${encodeURIComponent(id)}`)).json()) as { ok?: boolean; messages?: Msg[] };
      setMessages(d.ok && d.messages?.length ? d.messages.map((m) => ({ role: m.role, content: m.content })) : []);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadThreads();
      fetch("/api/portal/yuki/credits").then((r) => r.json()).then((d: { ok?: boolean; credits?: CreditsView }) => { if (alive && d.ok && d.credits) setCredits(d.credits); }).catch(() => {});
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const a = JSON.parse(raw) as { job_id: string; prompt: string; at: number; thread_id?: string };
          if (a.job_id && Date.now() - a.at < 40 * 60_000) { await openThread(a.thread_id ?? null); if (alive) void followJob(a.job_id, a.prompt, true); return; }
          localStorage.removeItem(LS_KEY);
        }
      } catch {}
      if (alive && window.matchMedia("(min-width: 1024px)").matches) {
        const d = (await (await fetch("/api/portal/yuki/threads")).json().catch(() => ({}))) as { threads?: ThreadMeta[] };
        const first = (d.threads ?? []).find((t) => !t.archived);
        if (first) void openThread(first.id);
      }
    })();
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

  const withLive = (fn: (m: Msg) => Msg) =>
    setMessages((cur) => {
      const i = cur.map((m) => !!m.live).lastIndexOf(true);
      if (i < 0) return [...cur, fn({ role: "assistant", content: "", parts: [], live: true })];
      const next = cur.slice(); next[i] = fn(cur[i]); return next;
    });
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
  const addStep = (label: string) => withLive((m) => ({ ...m, parts: [...(m.parts ?? []), { kind: "step", label, done: false, startedAt: Date.now() }] }));
  const addImage = (key: string, alt: string) => withLive((m) => ({ ...m, parts: [...(m.parts ?? []), { kind: "image", key, alt }] }));
  const finishStep = (failed = false) => withLive((m) => {
    const parts = [...(m.parts ?? [])];
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; if (p.kind === "step" && !p.done) { parts[i] = { ...p, done: true, failed, endedAt: Date.now() }; break; } }
    return { ...m, parts };
  });
  const seal = () => setMessages((cur) => cur.map((m) => ({ ...m, live: false })).filter((m) => !(m.role === "assistant" && !m.content.trim() && !(m.parts ?? []).some((p) => p.kind === "step" || p.kind === "image"))));

  async function followJob(jobId: string, prompt: string, resumed = false) {
    setBusy(true); statusRef.current = null; setError(null); setFinishedBanner(false);
    if (resumed) setMessages((cur) => [...cur.filter((m) => m.content !== "読み込んでいます…"), { role: "user", content: prompt }]);
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
          else if (t === "image" && typeof ev.key === "string" && IMG_KEY.test(ev.key)) addImage(ev.key, String(ev.alt ?? ""));
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
    void loadThreads();
  }

  /** 画像の添付: 縮めて /upload へ。返ってきたキーを依頼文の末尾に「添付画像: …」として付ける(ユキはこの行でキーを知る) */
  async function attach(files: FileList | null) {
    if (!files || !files.length || uploading) return;
    setUploading(true); setError(null);
    try {
      for (const f of Array.from(files).slice(0, 4 - attachments.length)) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError("JPEG / PNG / WebP の画像だけ添付できます"); continue; }
        const blob = await shrinkImage(f);
        const fd = new FormData(); fd.append("file", blob, f.name);
        const r = await fetch("/api/portal/yuki/upload", { method: "POST", body: fd });
        const d = (await r.json()) as { ok?: boolean; key?: string; error?: string };
        if (!d.ok || !d.key) { setError(d.error && d.error.length < 80 ? d.error : "画像を添付できませんでした"); continue; }
        setAttachments((cur) => [...cur, { key: d.key!, name: f.name, preview: URL.createObjectURL(blob) }]);
      }
    } catch { setError("画像を添付できませんでした"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send(text: string, grant?: Proposal | null) {
    let body = text.trim();
    if ((!body && !attachments.length) || busy || uploading) return;
    if (attachments.length) { body = (body || "画像を添付しました。") + "\n\n" + attachments.map((a) => `添付画像: ${a.key}`).join("\n"); }
    setError(null); setProposal(null);
    setMessages((cur) => [...cur.map((m) => ({ ...m, live: false })), { role: "user", content: body }]);
    setInput(""); setAttachments([]); nearBottomRef.current = true;
    if (/解約|クレーム|苦情|返金|法律|訴/.test(body)) seriousRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/yuki/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: body, ...(threadRef.current ? { thread_id: threadRef.current } : {}), ...(grant ? { paid_grant: { tool: grant.tool, args_hash: grant.args_hash } } : {}) }) });
      const d = (await res.json()) as { ok?: boolean; job_id?: string; thread_id?: string; error?: string; credits?: CreditsView };
      if (!d.ok || !d.job_id) { setError(d.error && d.error.length < 120 ? d.error : "送信に失敗しました。時間をおいてお試しください。"); if (d.credits) setCredits(d.credits); setBusy(false); return; }
      if (d.thread_id && d.thread_id !== threadRef.current) setThreadId(d.thread_id);
      try { localStorage.setItem(LS_KEY, JSON.stringify({ job_id: d.job_id, prompt: body, at: Date.now(), thread_id: d.thread_id ?? threadRef.current })); } catch {}
      await followJob(d.job_id, body);
    } catch { setError("通信に失敗しました。電波の良いところでお試しください。"); setBusy(false); }
  }

  const archive = async (id: string, archived: boolean) => {
    if (archived && !window.confirm("この相談を片付けますか?(あとで「片付けた相談」から戻せます。ユキの記憶は消えません)")) return;
    await fetch("/api/portal/yuki/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thread_id: id, archived }) }).catch(() => {});
    if (archived && threadId === id) void openThread(null);
    void loadThreads();
  };

  const fresh = messages.length === 0;
  const exhausted = !!credits?.exhausted;
  const currentTitle = threads.find((t) => t.id === threadId)?.title;

  const chatPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2 lg:hidden">
        <button onClick={() => setMobileView("list")} className="text-xs text-[#999]">← 相談一覧</button>
        <span className="truncate text-xs font-bold text-[#555]">{currentTitle || "新しい相談"}</span>
      </div>
      <div onScroll={(e) => { const el = e.currentTarget; nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (nearBottomRef.current) setFinishedBanner(false); }} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 lg:space-y-4 lg:px-6 lg:py-6">
        {fresh && !busy && <Welcome clientName={clientName} onPick={(s) => void send(s === "その他なんでも" ? "相談したいことがあります。" : s)} />}
        {messages.map((m, i) => (
          <div key={i} className={"yuki-in " + (m.role === "user" ? "flex justify-end" : "flex justify-start")}>
            {m.role === "user" ? (() => { const u = splitUser(m.content); return (
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-orange-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm lg:max-w-[70%] lg:text-[15px]">
                {u.text && <div className="whitespace-pre-wrap">{u.text}</div>}
                {u.images.length > 0 && <div className={"flex flex-wrap gap-1.5 " + (u.text ? "mt-2" : "")}>{u.images.map((k) => <a key={k} href={imgUrl(k)} target="_blank" rel="noreferrer"><img src={imgUrl(k)} alt="添付画像" loading="lazy" className="h-24 w-24 rounded-lg object-cover ring-2 ring-white/60" /></a>)}</div>}
              </div>); })()
            : (m.content.trim() || (m.parts ?? []).some((p) => p.kind === "step" || p.kind === "image")) ? <AssistantBubble m={m} /> : null}
          </div>
        ))}
        {proposal && !busy && (
          <div className="yuki-in rounded-3xl border border-orange-300 bg-[#fff8f0] px-4 py-3 text-sm text-[#222] shadow-sm">
            <p className="font-bold">この操作には <span className="text-[#c96a00]">{proposal.cost_label}</span> がかかります。実行してよろしいですか?</p>
            <p className="mt-1 text-xs text-[#777]">承認するとユキが先ほどの操作を実行します。迷う点があれば、承認の前にそのまま質問してください。</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void send("承認しました。先ほどご提案の操作を実行してください。", proposal)} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-orange-600">承認して実行</button>
              <button onClick={() => setProposal(null)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-[#555] hover:bg-black/5">今はやめる</button>
            </div>
          </div>
        )}
        {busy && <Thinking label={spinner} />}
        <div ref={bottomRef} />
      </div>
      {finishedBanner && (
        <button onClick={() => { setFinishedBanner(false); nearBottomRef.current = true; bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="yuki-in mx-4 mb-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">✅ ユキの作業が終わりました。結果を見る</button>
      )}
      {error && <p className="px-4 pb-1 text-xs font-bold text-red-500">{error}</p>}
      {exhausted && <p className="px-4 pb-1 text-xs font-bold text-[#c96a00]">今月のユキクレジットの枠を使い切りました。来月また一緒に働けます(ご相談の閲覧はできます)</p>}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {attachments.map((a) => (
            <div key={a.key} className="relative">
              <img src={a.preview} alt={a.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10" />
              <button onClick={() => setAttachments((cur) => cur.filter((x) => x.key !== a.key))} title="外す" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#222] text-[11px] font-bold text-white">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 border-t border-black/5 p-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void attach(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={busy || exhausted || uploading || attachments.length >= 4} title="画像を添付(参考画像・加工したい写真)" className="h-[44px] w-[44px] shrink-0 rounded-2xl border border-black/10 text-lg text-[#666] transition-colors hover:border-sky-300 hover:bg-sky-50 disabled:opacity-40">{uploading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" /> : "📎"}</button>
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
          rows={2} maxLength={4000} disabled={exhausted} placeholder={exhausted ? "今月の枠を使い切りました" : busy ? "ユキが作業中です(終わったら続けて送れます)" : attachments.length ? "この画像をどうしたいか(例: この写真の雰囲気で投稿用の画像を)" : "ご相談・ご依頼を入力(📎で画像も添付できます)"}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-black/10 px-3 py-2.5 text-sm outline-none transition-colors focus:border-orange-400 disabled:bg-black/5 lg:min-h-[72px] lg:text-[15px]" />
        <button onClick={() => void send(input)} disabled={busy || exhausted || uploading || (!input.trim() && !attachments.length)} className="h-[44px] shrink-0 rounded-2xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-40">送信</button>
      </div>
    </div>
  );

  const tabs = (
    <div className="flex gap-1 px-3 pt-2">
      {(["chat", "notes"] as const).map((k) => (
        <button key={k} onClick={() => { setTab(k); if (k === "chat") setMobileView("list"); }} className={"rounded-full px-3 py-1 text-xs font-bold transition-colors " + (tab === k ? "bg-[#222] text-white" : "bg-black/5 text-[#666] hover:bg-black/10")}>{k === "chat" ? "相談" : "ノート"}</button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] min-h-[520px] w-full flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:h-[calc(100dvh-10.5rem)]">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <header className="flex items-center gap-3 border-b border-black/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 text-lg font-black text-white">ユ</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#222]">{clientName ? `${clientName}さま専任 ` : ""}AI担当 ユキ</p>
          <p className="text-xs text-[#888]">動画の設計図・記憶ノート・日々のご相談を承ります</p>
        </div>
        <a href="/portal" className="ml-auto shrink-0 text-xs text-[#999] underline">マイページ</a>
      </header>
      <div className="border-b border-black/5"><CreditsBar c={credits} /></div>

      {/* PC: 2ペイン */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-r border-black/5">
          {tabs}
          <div className="min-h-0 flex-1">{tab === "chat" ? <ThreadList threads={threads} currentId={threadId} onOpen={(id) => void openThread(id)} onNew={() => void openThread(null)} onArchive={archive} /> : <p className="p-3 text-xs text-[#999]">右にノートの一覧と中身が出ます</p>}</div>
        </aside>
        <section className="min-h-0">{tab === "chat" ? chatPane : <NotesPane compact={false} />}</section>
      </div>

      {/* スマホ: セグメント → 一覧 → チャット */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {(tab === "notes" || mobileView === "list") && tabs}
        <div className="min-h-0 flex-1">
          {tab === "notes" ? <NotesPane compact onBack={() => setTab("chat")} /> : mobileView === "list" ? <ThreadList threads={threads} currentId={threadId} onOpen={(id) => void openThread(id)} onNew={() => void openThread(null)} onArchive={archive} /> : chatPane}
        </div>
      </div>
    </div>
  );
}
