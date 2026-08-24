"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHECKS, EXMAP, FOODS, MAX, PARTS, PLAN, TGT, guessLocal,
} from "./config";
import styles from "./tracker.module.css";

type SetRow = { kg: number; r: number };
type XItem = { n: string; p: number; q: number };
type Day = {
  f: Record<string, number>;
  c: Record<string, boolean>;
  g: string | null;
  ex: Record<string, SetRow[]>;
  sk: Record<string, 1>;
  x: XItem[];
  w: number | null;
};
type State = { days: Record<string, Day> };

const LOCAL = "byakuyaai.me.v1";

const pad = (n: number) => String(n).padStart(2, "0");
const tk = (d?: Date) => {
  const x = d || new Date();
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const shift = (k: string, n: number) => {
  const [y, m, d] = k.split("-").map(Number);
  return tk(new Date(y, m - 1, d + n));
};
const blank = (): Day => ({ f: {}, c: {}, g: null, ex: {}, sk: {}, x: [], w: null });
const norm = (d: Partial<Day> | undefined): Day => ({
  ...blank(), ...(d || {}),
  f: d?.f || {}, c: d?.c || {}, ex: d?.ex || {}, sk: d?.sk || {}, x: d?.x || [],
});

export default function Tracker() {
  const [S, setS] = useState<State>({ days: {} });
  const [cur, setCur] = useState(tk());
  const [tab, setTab] = useState(0);
  const [calM, setCalM] = useState(tk().slice(0, 7));
  const [status, setStatus] = useState<{ t: string; k?: "ok" | "bad" }>({ t: "読み込み中…" });
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const day = useCallback((k: string): Day => norm(S.days[k]), [S]);

  const protein = useCallback((k: string) => {
    const o = S.days[k]; if (!o) return 0;
    let t = 0;
    for (const f of FOODS) t += (o.f?.[f.id] || 0) * f.p;
    for (const it of o.x || []) t += (it.p || 0) * (it.q || 1);
    return t;
  }, [S]);

  const score = useCallback((k: string) => {
    const o = S.days[k]; if (!o) return 0;
    const p = protein(k);
    let s = Math.min(50, Math.round((p / TGT) * 50));
    if (p >= TGT) s += 5;            // 目標到達ボーナス
    for (const c of CHECKS) if (o.c?.[c.id]) s += c.pt;
    if (o.g) s += 15;
    return Math.max(0, Math.min(100, s));
  }, [S, protein]);

  const hasRec = useCallback((k: string) => {
    const o = S.days[k]; if (!o) return false;
    return protein(k) > 0 || !!o.g || !!o.w || Object.keys(o.c || {}).length > 0;
  }, [S, protein]);

  const vol = useCallback((k: string, part?: string) => {
    const o = S.days[k]; if (!o?.ex) return 0;
    let t = 0;
    for (const id of Object.keys(o.ex)) {
      if (o.sk?.[id]) continue;
      if (part && EXMAP[id]?.part !== part) continue;
      for (const s of o.ex[id]) if (s.kg && s.r) t += s.kg * s.r;
    }
    return t;
  }, [S]);

  const lastSets = useCallback((id: string, before: string) => {
    const ks = Object.keys(S.days).filter((k) => k < before).sort().reverse();
    for (const k of ks) {
      const o = S.days[k];
      if (o.sk?.[id]) continue;
      const e = o.ex?.[id];
      if (e?.length && e.some((s) => s.kg > 0)) return { k, sets: e };
    }
    return null;
  }, [S]);

  /* ── persistence ─────────────────────────────── */
  const save = useCallback(async (snap: State, keys: string[]) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try { localStorage.setItem(LOCAL, JSON.stringify(snap)); } catch { /* private mode */ }
    if (!keys.length) return;
    const patch: State = { days: {} };
    for (const k of keys) if (snap.days[k]) patch.days[k] = snap.days[k];
    setStatus({ t: "保存中…" });
    try {
      const r = await fetch("/api/me/log", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (r.status === 401) { location.href = "/me/login"; return; }
      if (!r.ok) throw new Error(String(r.status));
      pending.current.clear();
      setDirty(false);
      setStatus({ t: `保存済み ${new Date().toTimeString().slice(0, 5)}`, k: "ok" });
    } catch {
      setStatus({ t: "保存できず（端末には残っています）", k: "bad" });
    }
  }, []);

  const touch = useCallback((k: string, fn: (d: Day) => void) => {
    setS((prev) => {
      const d = norm(prev.days[k]);
      fn(d);
      const next = { days: { ...prev.days, [k]: d } };
      pending.current.add(k);
      try { localStorage.setItem(LOCAL, JSON.stringify(next)); } catch { /* ignore */ }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next, [...pending.current]), 1500);
      return next;
    });
    setDirty(true);
    setStatus({ t: "未保存" });
  }, [save]);

  useEffect(() => {
    (async () => {
      let local: State | null = null;
      try {
        const raw = localStorage.getItem(LOCAL);
        if (raw) local = JSON.parse(raw);
      } catch { /* ignore */ }
      try {
        const r = await fetch("/api/me/log", { cache: "no-store" });
        if (r.status === 401) { location.href = "/me/login"; return; }
        const j = await r.json();
        if (j?.ok) {
          // Server is the source of truth; unsynced local days win only where
          // the server has nothing (a save that failed while offline).
          const days = { ...(j.days || {}) };
          for (const k of Object.keys(local?.days || {})) if (!days[k]) days[k] = local!.days[k];
          setS({ days });
          setStatus({ t: "同期済み", k: "ok" });
        } else throw new Error("load");
      } catch {
        if (local) setS(local);
        setStatus({ t: "オフライン（端末のデータ）", k: "bad" });
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /* ── derived ─────────────────────────────────── */
  const o = day(cur);
  const p = protein(cur);
  const sc = score(cur);
  const [cy, cm] = [Number(cur.slice(0, 4)), Number(cur.slice(5, 7))];
  const cd = Number(cur.slice(8, 10));
  const wd = "日月火水木金土"[new Date(cy, cm - 1, cd).getDay()];
  const planPart = PLAN[new Date(cy, cm - 1, cd).getDay()] || null;

  const month = useMemo(() => {
    const y = Number(calM.slice(0, 4)), m = Number(calM.slice(5, 7));
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const prevLast = new Date(y, m - 1, 0).getDate();
    const cells: { k?: string; n: number; padCell?: boolean }[] = [];
    for (let i = lead - 1; i >= 0; i--) cells.push({ n: prevLast - i, padCell: true });
    for (let d = 1; d <= last; d++) cells.push({ k: `${y}-${pad(m)}-${pad(d)}`, n: d });
    const tail = (7 - ((lead + last) % 7)) % 7;
    for (let i = 1; i <= tail; i++) cells.push({ n: i, padCell: true });
    return cells;
  }, [calM]);

  const summary = useMemo(() => {
    const ks = Object.keys(S.days).filter((k) => k.slice(0, 7) === calM && hasRec(k));
    let sp = 0, ss = 0, g = 0, hit = 0, tv = 0;
    for (const k of ks) {
      sp += protein(k); ss += score(k);
      if (S.days[k].g && S.days[k].g !== "rest") g++;
      if (protein(k) >= TGT) hit++;
      tv += vol(k);
    }
    const n = ks.length;
    return {
      n, avgP: n ? Math.round(sp / n) : null, avgS: n ? Math.round(ss / n) : null,
      gym: g, hit, tons: tv ? (tv / 1000).toFixed(1) : null,
    };
  }, [S, calM, hasRec, protein, score, vol]);

  const last30 = useMemo(() => {
    const out: string[] = [];
    for (let i = 29; i >= 0; i--) out.push(shift(tk(), -i));
    return out;
  }, []);

  const growth = useMemo(() => PARTS.filter((x) => x.ex.length).map((pt) => ({
    c: pt.c, n: pt.n,
    pts: Object.keys(S.days).sort().map((k) => ({ k, v: vol(k, pt.id) })).filter((x) => x.v > 0),
  })), [S, vol]);

  const weights = useMemo(() =>
    Object.keys(S.days).sort().filter((k) => S.days[k].w).map((k) => ({ k, v: S.days[k].w as number })),
    [S]);

  const weekVol = useMemo(() => {
    const out: { v: number; l: string }[] = [];
    for (let w = 7; w >= 0; w--) {
      let t = 0;
      for (let d = 0; d < 7; d++) t += vol(shift(tk(), -(w * 7 + d)));
      out.push({ v: Math.round(t / 100) / 10, l: w === 0 ? "今週" : `-${w}w` });
    }
    return out;
  }, [vol]);

  if (!ready) return <div className={styles.boot}>読み込み中…</div>;

  return (
    <div className={styles.wrap}>
      <header className={styles.hdr}>
        <div className={styles.hrow}>
          <button className={styles.dbtn} onClick={() => { const k = shift(cur, -1); setCur(k); setCalM(k.slice(0, 7)); }} aria-label="前の日">◀</button>
          <div className={styles.dwrap}>
            <div className={styles.dmain}>{cm}月{cd}日 ({wd})</div>
            <div className={styles.dsub}>{cur === tk() ? "TODAY" : cy}</div>
          </div>
          <button className={styles.dbtn} disabled={cur >= tk()}
            onClick={() => { if (cur < tk()) { const k = shift(cur, 1); setCur(k); setCalM(k.slice(0, 7)); } }} aria-label="次の日">▶</button>
          <div className={styles.sc}>
            <span className={sc < 50 ? `${styles.scv} ${styles.low}` : styles.scv}>{sc}</span>
            <span className={styles.scu}>/100</span>
          </div>
        </div>
        <div className={styles.tabs} role="tablist">
          {["食事", "トレーニング", "レポート"].map((t, i) => (
            <button key={t} role="tab" aria-selected={tab === i}
              onClick={() => { setTab(i); if (i === 2) setCalM(cur.slice(0, 7)); window.scrollTo(0, 0); }}>{t}</button>
          ))}
        </div>
      </header>

      {tab === 0 && (
        <MealTab
          o={o} p={p} cur={cur} touch={touch} S={S}
        />
      )}

      {tab === 1 && (
        <TrainTab
          o={o} cur={cur} touch={touch} planPart={planPart} lastSets={lastSets}
        />
      )}

      {tab === 2 && (
        <ReportTab
          calM={calM} setCalM={setCalM} month={month} cur={cur} setCur={setCur}
          S={S} protein={protein} score={score} summary={summary}
          last30={last30} growth={growth} weights={weights} weekVol={weekVol}
          setTab={setTab}
        />
      )}

      <div className={styles.bar}>
        <span className={status.k === "ok" ? `${styles.st} ${styles.ok}` : status.k === "bad" ? `${styles.st} ${styles.bad}` : styles.st}>{status.t}</span>
        <button className={styles.save} disabled={!dirty}
          onClick={() => save(S, [...pending.current])}>保存</button>
      </div>
    </div>
  );
}

/* ══════════════ 食事 ══════════════ */
function MealTab({ o, p, cur, touch, S }: {
  o: Day; p: number; cur: string; S: State;
  touch: (k: string, fn: (d: Day) => void) => void;
}) {
  const [xn, setXn] = useState("");
  const [xg, setXg] = useState("");
  const [xq, setXq] = useState("1");
  const [touched, setTouched] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const prevW = useMemo(() => {
    const ks = Object.keys(S.days).filter((k) => k < cur && S.days[k].w).sort().reverse();
    return ks.length ? (S.days[ks[0]].w as number) : null;
  }, [S, cur]);

  const inc = (id: string, n: number) => touch(cur, (d) => {
    d.f[id] = Math.max(0, (d.f[id] || 0) + n);
    if (!d.f[id]) delete d.f[id];
  });

  const addX = (name: string, grams: number, qty: number) => {
    const n = name.trim(); if (!n) return;
    touch(cur, (d) => { d.x = [...d.x, { n, p: grams, q: Math.max(1, qty) }]; });
    setXn(""); setXg(""); setXq("1"); setTouched(false);
  };

  async function askAI(payload: { text?: string; image?: string; mime?: string }) {
    setAiBusy(true); setAiMsg("AIが推定中…");
    try {
      const r = await fetch("/api/me/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) { setAiMsg(j.error || "推定できませんでした"); return; }
      if (!j.items?.length) { setAiMsg("料理を判別できませんでした"); return; }
      touch(cur, (d) => {
        d.x = [...d.x, ...j.items.map((i: { name: string; grams: number }) => ({ n: i.name, p: i.grams, q: 1 }))];
      });
      setAiMsg(`${j.items.map((i: { name: string; grams: number }) => `${i.name} ${i.grams}g`).join(" / ")} を追加`);
    } catch {
      setAiMsg("AIに接続できませんでした");
    } finally { setAiBusy(false); }
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { askAI({ image: String(rd.result), mime: f.type }); e.target.value = ""; };
    rd.readAsDataURL(f);
  }

  return (
    <>
      <section className={styles.sec}>
        <h2>タンパク質</h2>
        <p className={styles.sub}>タップで＋1。もう一度押すか、下の − ＋ で調整。</p>
        <div className={`${styles.card} ${styles.meter}`}>
          <div className={styles.mtop}>
            <div className={styles.mnum}>{p}<small>g</small></div>
            <div className={styles.mtag}>目標 {TGT}–{MAX} g</div>
          </div>
          <div className={styles.track}>
            <i style={{ width: `${Math.min(100, (p / MAX) * 100)}%` }} />
            <b style={{ left: `${(TGT / MAX) * 100}%` }} />
          </div>
          <div className={styles.mnote}>
            {p === 0 ? "まだ記録なし" : TGT - p > 0 ? `目標まであと ${TGT - p} g` : `目標達成 +${p - TGT} g ／ ボーナス +5点`}
          </div>
        </div>
        <div className={styles.foods}>
          {FOODS.map((f) => {
            const n = o.f[f.id] || 0;
            return (
              <div key={f.id} className={n > 0 ? `${styles.food} ${styles.act}` : styles.food}>
                <button className={styles.hit} onClick={() => inc(f.id, 1)}>
                  <span className={styles.fn}>{f.n}</span>
                  <span className={styles.fp}>{f.p}g/{f.u}</span>
                </button>
                {n > 0 && (
                  <div className={styles.ctl}>
                    <button onClick={() => inc(f.id, -1)} aria-label="減らす">−</button>
                    <span className={styles.n}>{n}</span>
                    <button onClick={() => inc(f.id, 1)} aria-label="増やす">＋</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.sec}>
        <h2>その他に食べたもの</h2>
        <p className={styles.sub}>名前を入れるかレシートの代わりに写真を撮ると、AIがタンパク質量を推定する。</p>
        <div className={styles.card}>
          <div className={styles.addrow}>
            <input className={styles.fld} placeholder="例: ばあちゃんのカレー" value={xn} autoComplete="off"
              onChange={(e) => {
                setXn(e.target.value);
                if (!touched) { const g = guessLocal(e.target.value); if (g != null) setXg(String(g)); }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") addX(xn, Number(xg) || guessLocal(xn) || 0, Number(xq) || 1); }} />
            <input className={`${styles.fld} ${styles.num}`} type="number" inputMode="numeric" placeholder="g"
              value={xg} onChange={(e) => { setTouched(true); setXg(e.target.value); }} />
            <input className={`${styles.fld} ${styles.num}`} type="number" inputMode="numeric" min={1}
              value={xq} onChange={(e) => setXq(e.target.value)} />
            <button className={styles.addbtn} onClick={() => addX(xn, Number(xg) || guessLocal(xn) || 0, Number(xq) || 1)}>＋</button>
          </div>

          <div className={styles.airow}>
            <button className={styles.mini} disabled={aiBusy || !xn.trim()}
              onClick={() => askAI({ text: `${xn}${Number(xq) > 1 ? ` ${xq}人前` : ""}` })}>AIで推定</button>
            <button className={styles.mini} disabled={aiBusy} onClick={() => fileRef.current?.click()}>写真から読み取る</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          </div>
          {aiMsg && <div className={styles.mnote}>{aiMsg}</div>}

          <div className={styles.xlist}>
            {!o.x.length ? <div className={styles.mnote}>追加なし</div> : o.x.map((it, i) => (
              <div key={i} className={styles.xitem}>
                <div>{it.n}{it.q > 1 && <span className={styles.q}> ×{it.q}</span>}</div>
                <div className={styles.g}>{it.p * it.q} g</div>
                <button className={styles.rm} onClick={() => touch(cur, (d) => { d.x = d.x.filter((_, j) => j !== i); })}>×</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sec}>
        <h2>チェック</h2>
        <p className={styles.sub}>サプリは夕食後30分以内にまとめて1回。</p>
        <div className={styles.chips}>
          {CHECKS.map((c) => (
            <button key={c.id} aria-pressed={!!o.c[c.id]}
              className={c.neg ? `${styles.chip} ${styles.neg}` : styles.chip}
              onClick={() => touch(cur, (d) => { if (d.c[c.id]) delete d.c[c.id]; else d.c[c.id] = true; })}>
              {c.n}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.sec}>
        <h2>体重</h2>
        <div className={styles.card}>
          <div className={styles.wrow}>
            <input className={`${styles.fld} ${styles.num}`} type="number" inputMode="decimal" step={0.1}
              placeholder="—" style={{ width: 100, fontSize: 17 }}
              value={o.w ?? ""} onChange={(e) => touch(cur, (d) => { d.w = parseFloat(e.target.value) || null; })} />
            <span className={styles.unit}>kg</span>
            {o.w && prevW != null && (
              <span className={styles.mnote}>
                {o.w - prevW >= 0 ? "+" : ""}{(o.w - prevW).toFixed(1)} kg 前回比
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={styles.sec}>
        <h2>今週の献立</h2>
        <p className={styles.sub}>仕込み・買い物リスト・7日分のメニュー・守るルール。</p>
        <a className={`${styles.card} ${styles.link}`} href="/me/week">
          <div className={styles.linkT}>85点の一週間</div>
          <div className={styles.linkD}>献立表・買い物リスト・サプリの時間・ジム分割</div>
          <div className={styles.linkG}>開く →</div>
        </a>
      </section>
    </>
  );
}

/* ══════════════ トレーニング ══════════════ */
function TrainTab({ o, cur, touch, planPart, lastSets }: {
  o: Day; cur: string; planPart: string | null;
  touch: (k: string, fn: (d: Day) => void) => void;
  lastSets: (id: string, before: string) => { k: string; sets: SetRow[] } | null;
}) {
  const part = PARTS.find((x) => x.id === o.g);
  return (
    <>
      <section className={styles.sec}>
        <h2>部位</h2>
        <p className={styles.sub}>月＝胸／火＝肩／水＝腕／木＝背中。重量は前回の値を引き継ぐ。</p>
        <div className={styles.plan}>
          {planPart ? <>今日の予定 → <b>{PARTS.find((x) => x.id === planPart)?.n}</b></> : "今日は予定なし（休養）"}
        </div>
        <div className={styles.chips}>
          {PARTS.map((pt) => (
            <button key={pt.id} className={styles.chip} aria-pressed={o.g === pt.id}
              onClick={() => touch(cur, (d) => { d.g = d.g === pt.id ? null : pt.id; })}>{pt.n}</button>
          ))}
        </div>
      </section>

      <section className={styles.sec}>
        {!part || !part.ex.length ? (
          <div className={styles.empty}>{o.g === "rest" ? "休養日" : "部位を選ぶと種目が出る"}</div>
        ) : part.ex.map((e) => {
          const sk = !!o.sk[e.id];
          const prev = lastSets(e.id, cur);
          const sets = o.ex[e.id] || (prev
            ? prev.sets.map((s) => ({ kg: s.kg, r: s.r }))
            : Array.from({ length: e.s }, () => ({ kg: e.kg, r: e.r })));
          const v = sets.reduce((t, s) => t + (s.kg && s.r ? s.kg * s.r : 0), 0);
          const put = (fn: (arr: SetRow[]) => SetRow[]) =>
            touch(cur, (d) => { d.ex[e.id] = fn(d.ex[e.id] || sets.map((s) => ({ ...s }))); });
          return (
            <div key={e.id} className={sk ? `${styles.ex} ${styles.skip}` : styles.ex}>
              <div className={styles.exh}>
                <div className={styles.exn}>{e.n}</div>
                <div className={styles.exr}>
                  <div className={styles.exv}>{sk ? "スキップ" : `${v.toLocaleString()} kg`}</div>
                  <button className={styles.sk} aria-pressed={sk}
                    onClick={() => touch(cur, (d) => { if (d.sk[e.id]) delete d.sk[e.id]; else d.sk[e.id] = 1; })}>
                    {sk ? "戻す" : "スキップ"}
                  </button>
                </div>
              </div>
              {!sk && (
                <div className={styles.sets}>
                  <div className={styles.slab}><span /><span>kg</span><span>回</span><span /></div>
                  {sets.map((s, i) => (
                    <div key={i} className={styles.srow}>
                      <div className={styles.sno}>{i + 1}</div>
                      <input type="number" inputMode="decimal" step={2.5} value={s.kg || ""} aria-label="重量"
                        onChange={(ev) => put((a) => a.map((x, j) => j === i ? { ...x, kg: parseFloat(ev.target.value) || 0 } : x))} />
                      <input type="number" inputMode="numeric" value={s.r || ""} aria-label="回数"
                        onChange={(ev) => put((a) => a.map((x, j) => j === i ? { ...x, r: parseInt(ev.target.value) || 0 } : x))} />
                      <button className={styles.x} aria-label="削除"
                        onClick={() => put((a) => a.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                  <button className={styles.addset}
                    onClick={() => put((a) => [...a, { ...(a[a.length - 1] || { kg: e.kg, r: e.r }) }])}>＋ セットを追加</button>
                </div>
              )}
              {!sk && prev && (
                <div className={styles.ph}>前回 {prev.k.slice(5)} — {prev.sets.map((s) => `${s.kg}×${s.r}`).join(" / ")}</div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

/* ══════════════ レポート ══════════════ */
function Bars({ vals, tgt, labels }: { vals: number[]; tgt?: number; labels?: string[] }) {
  if (!vals.length) return <div className={styles.empty}>記録がありません</div>;
  const mx = Math.max(tgt || 0, ...vals, 1);
  return (
    <>
      <div className={styles.bars}>
        {vals.map((v, i) => (
          <div key={i} className={styles.b}>
            <i className={tgt && v < tgt ? styles.u : ""}
              style={{ height: v > 0 ? `${Math.max(3, Math.round((v / mx) * 100))}%` : 0 }} />
          </div>
        ))}
      </div>
      {labels && <div className={styles.xlab}>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>}
    </>
  );
}

function Lines({ series, goal, h = 90 }: {
  series: { c: string; pts: { k: string; v: number }[] }[]; goal?: number; h?: number;
}) {
  const all = series.flatMap((s) => s.pts.map((p) => p.v));
  if (all.length < 2) return <div className={styles.empty}>2回以上記録するとグラフが出る</div>;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (goal) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
  const padv = (hi - lo) * 0.15 || 1.5; lo -= padv; hi += padv;
  const keys = [...new Set(series.flatMap((s) => s.pts.map((p) => p.k)))].sort();
  const m = 5;
  const X = (k: string) => m + (100 - m * 2) * (keys.length < 2 ? 0.5 : keys.indexOf(k) / (keys.length - 1));
  const Y = (v: number) => 100 - m - (100 - m * 2) * ((v - lo) / (hi - lo || 1));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: h, width: "100%", display: "block", overflow: "visible" }}>
      {goal != null && <line x1="0" y1={Y(goal)} x2="100" y2={Y(goal)} stroke="var(--warm)" strokeWidth="0.6" strokeDasharray="2 2" />}
      {series.map((s, si) => s.pts.length ? (
        <g key={si}>
          <path d={s.pts.map((p, i) => `${i ? "L" : "M"}${X(p.k).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}
            fill="none" stroke={`var(${s.c})`} strokeWidth="1.6" vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" strokeLinecap="round" />
          {s.pts.map((p, i) => <circle key={i} cx={X(p.k)} cy={Y(p.v)} r="1.6" fill={`var(${s.c})`} />)}
        </g>
      ) : null)}
    </svg>
  );
}

function ReportTab(props: {
  calM: string; setCalM: (s: string) => void;
  month: { k?: string; n: number; padCell?: boolean }[];
  cur: string; setCur: (s: string) => void; setTab: (n: number) => void;
  S: State; protein: (k: string) => number; score: (k: string) => number;
  summary: { n: number; avgP: number | null; avgS: number | null; gym: number; hit: number; tons: string | null };
  last30: string[];
  growth: { c: string; n: string; pts: { k: string; v: number }[] }[];
  weights: { k: string; v: number }[];
  weekVol: { v: number; l: string }[];
}) {
  const { calM, setCalM, month, cur, setCur, setTab, S, protein, score, summary, last30, growth, weights, weekVol } = props;
  const y = Number(calM.slice(0, 4)), m = Number(calM.slice(5, 7));
  const moveMonth = (d: number) => {
    const x = new Date(y, m - 1 + d, 1);
    setCalM(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  };
  const totalT = weekVol.reduce((a, b) => a + b.v, 0);
  return (
    <>
      <section className={styles.sec}>
        <h2>カレンダー</h2>
        <p className={styles.sub}>緑＝食事の記録／橙＝トレーニング。タップでその日へ。</p>
        <div className={styles.card}>
          <div className={styles.calhd}>
            <div className={styles.calm}>{y}年 {m}月</div>
            <div className={styles.calnav}>
              <button className={styles.dbtn} onClick={() => moveMonth(-1)} aria-label="前の月">◀</button>
              <button className={styles.dbtn} onClick={() => moveMonth(1)} aria-label="次の月">▶</button>
            </div>
          </div>
          <div className={styles.dow}>
            {["月", "火", "水", "木", "金"].map((d) => <span key={d}>{d}</span>)}
            <span className={styles.sa}>土</span><span className={styles.su}>日</span>
          </div>
          <div className={styles.cal}>
            {month.map((c, i) => {
              if (c.padCell) return <div key={i} className={`${styles.cell} ${styles.padc}`}>{c.n}</div>;
              const k = c.k!;
              const d = S.days[k];
              const cls = [styles.cell, k === cur ? styles.sel : "", k === tk() ? styles.today : ""].filter(Boolean).join(" ");
              return (
                <div key={i} className={cls} onClick={() => { setCur(k); setTab(0); }}>
                  <span>{c.n}</span>
                  <span className={styles.pip}>
                    {d && protein(k) > 0 && <i />}
                    {d?.g && d.g !== "rest" && <i className={styles.gpip} />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.sec}>
        <h2>今月のサマリー</h2>
        <div className={styles.grid3}>
          <div className={styles.st2}><div className={styles.v}>{summary.avgP ?? "—"}</div><div className={styles.k}>平均 P/日</div></div>
          <div className={styles.st2}><div className={styles.v}>{summary.avgS ?? "—"}</div><div className={styles.k}>平均スコア</div></div>
          <div className={styles.st2}><div className={styles.v}>{summary.gym}</div><div className={styles.k}>ジム回数</div></div>
        </div>
        <div className={styles.grid3} style={{ marginTop: 8 }}>
          <div className={styles.st2}><div className={styles.v}>{summary.n}</div><div className={styles.k}>記録日数</div></div>
          <div className={styles.st2}><div className={styles.v}>{summary.hit}</div><div className={styles.k}>目標達成日</div></div>
          <div className={styles.st2}><div className={styles.v}>{summary.tons ?? "—"}</div><div className={styles.k}>総ボリューム t</div></div>
        </div>
      </section>

      <section className={styles.sec}>
        <h2>グラフ</h2>

        <div className={styles.chart}>
          <div className={styles.ct}>部位別の成長</div>
          <div className={styles.cs}>1回あたりの挙上量（kg）の推移</div>
          {growth.every((g) => g.pts.length < 2)
            ? <div className={styles.empty}>同じ部位を2回以上やると線が伸びる</div>
            : <Lines series={growth} h={100} />}
          <div className={styles.leg}>
            {growth.map((g) => (
              <span key={g.n}><i style={{ background: `var(${g.c})` }} />{g.n}</span>
            ))}
          </div>
        </div>

        <div className={styles.chart}>
          <div className={styles.ct}>タンパク質</div>
          <div className={styles.cs}>直近30日／灰色は目標{TGT}g未達</div>
          <Bars vals={last30.map(protein)} tgt={TGT} />
        </div>

        <div className={styles.chart}>
          <div className={styles.ct}>スコア</div>
          <div className={styles.cs}>直近30日／灰色は85点未満</div>
          <Bars vals={last30.map(score)} tgt={85} />
        </div>

        <div className={styles.chart}>
          <div className={styles.ct}>体重</div>
          <div className={styles.cs}>{weights.length ? `最新 ${weights[weights.length - 1].v} kg／${weights.length}回記録` : "未記録"}</div>
          <Lines series={[{ c: "--c1", pts: weights }]} h={84} />
        </div>

        <div className={styles.chart}>
          <div className={styles.ct}>週間ボリューム</div>
          <div className={styles.cs}>直近8週間の合計挙上量（トン）／合計 {totalT.toFixed(1)} t</div>
          <Bars vals={weekVol.map((w) => w.v)} labels={weekVol.map((w) => w.l)} />
        </div>
      </section>
    </>
  );
}
