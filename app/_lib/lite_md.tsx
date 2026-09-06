// チャット吹き出し用の軽量Markdown描画(2026-09-02)
// ユキの長文(箇条書き・見出し・表・太字)を「文章として流れる」形で見せる。
// HTML文字列は一切生成せず React ノードを組み立てる(注入の余地を作らない)。
// 対応: **太字** / `code` / #〜#### 見出し / -・• 箇条書き / 1. 番号 / | 表 | / --- 区切り
"use client";

import React from "react";

// 画像は当社の表示口(/api/portal/yuki/image?key=…)だけ描く(外部URLは文字のまま=注入の余地を作らない)
const IMG_SRC = /^\/api\/portal\/yuki\/image\?key=images(?:\/|%2F)(?:in|out)(?:\/|%2F)[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/;  // key は encodeURIComponent 済み(%2F)でも素の / でもよい

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|!\[[^\]\n]*\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${key}-b${i}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("![")) {
      const mm = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(tok);
      const src = mm?.[2] ?? "";
      if (mm && IMG_SRC.test(src)) out.push(<a key={`${key}-i${i}`} href={src} target="_blank" rel="noreferrer" className="chat-img"><img src={src} alt={mm[1]} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 360, borderRadius: 12, margin: "6px 0", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }} /></a>);
      else out.push(tok);
    }
    else out.push(<code key={`${key}-c${i}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function splitRow(line: string): string[] {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.map((c) => c.trim());
}

const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isUl = (l: string) => /^\s*[-*・•]\s+/.test(l);
const isOl = (l: string) => /^\s*\d+[.)]\s+/.test(l);
const isHr = (l: string) => /^\s*-{3,}\s*$/.test(l);

export default function LiteMd({ text }: { text: string }) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `n${k++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // 表
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const kk = key();
      nodes.push(
        <table key={kk}>
          <thead>
            <tr>{head.map((h, j) => <th key={`${kk}-h${j}`}>{inline(h, `${kk}-h${j}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={`${kk}-r${ri}`}>
                {head.map((_, j) => <td key={`${kk}-r${ri}c${j}`}>{inline(r[j] ?? "", `${kk}-r${ri}c${j}`)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    // 見出し
    const h = /^\s*(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const kk = key();
      const level = h[1].length;
      const body = inline(h[2], kk);
      nodes.push(level <= 2 ? <h3 key={kk}>{body}</h3> : <h4 key={kk}>{body}</h4>);
      i += 1;
      continue;
    }
    if (isHr(line)) {
      nodes.push(<hr key={key()} />);
      i += 1;
      continue;
    }
    // 箇条書き
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? isOl(lines[i]) : isUl(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*・•]\s+/, ""));
        i += 1;
        // 継続行(インデントされた次行)は同じ項目に繋ぐ
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !isUl(lines[i]) && !isOl(lines[i])) {
          items[items.length - 1] += " " + lines[i].trim();
          i += 1;
        }
      }
      const kk = key();
      const lis = items.map((it, j) => <li key={`${kk}-i${j}`}>{inline(it, `${kk}-i${j}`)}</li>);
      nodes.push(ordered ? <ol key={kk}>{lis}</ol> : <ul key={kk}>{lis}</ul>);
      continue;
    }
    // 段落(連続する通常行を改行で繋ぐ)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isUl(lines[i]) &&
      !isOl(lines[i]) &&
      !isHr(lines[i]) &&
      !/^\s*#{1,4}\s+/.test(lines[i]) &&
      !(isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    const kk = key();
    nodes.push(
      <p key={kk}>
        {para.map((l, j) => (
          <React.Fragment key={`${kk}-l${j}`}>
            {j > 0 && <br />}
            {inline(l, `${kk}-l${j}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }
  return <div className="chat-md">{nodes}</div>;
}
