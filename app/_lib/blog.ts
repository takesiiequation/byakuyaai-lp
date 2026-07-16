import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";
import type { Root, Heading, RootContent } from "mdast";

/**
 * ブログ記事ローダー。
 * content/blog/*.md を正本として読み込み、HTML・目次(H2)・FAQ(H3が疑問形の章)を
 * ビルド時(SSG)に一括生成する。以後の正本はこのリポジトリ側。
 * fudosan-video/docs/blog_drafts 側は変更しない(移植元・検品済みの控え)。
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type ClusterId = "A" | "B" | "C" | "D" | "E" | "F";

export const CLUSTER_LABELS: Record<ClusterId, string> = {
  A: "SNS動画マーケティング",
  B: "外注・比較・導入検討",
  C: "広告コンプライアンス",
  D: "AI時代の集客(MEO・AEO)",
  E: "LINE×AI",
  F: "バズの型・AI動画技術",
};

// 公開順(トピックマップの掲載順に合わせた表示順)。
// 新しい記事を追加したら id をここに足す。
const DISPLAY_ORDER = ["A1", "A6", "B1", "B2", "B3", "B4", "B5", "B6", "C1", "C4"];

export type TocItem = { id: string; text: string; depth: number };
export type FaqItem = { question: string; answer: string };

export type PostFrontmatter = {
  id: string;
  title: string;
  slug: string;
  description: string;
  cluster: ClusterId;
  priority: string;
  written: string; // ISO date (YYYY-MM-DD)
  target_queries?: string[];
  thumbnail?: string; // 例: /blog/{slug}.jpg (未設定でも壊れないfail-soft)
};

export type PostMeta = {
  slug: string;
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  cluster: ClusterId;
  clusterLabel: string;
  priority: string;
  readingMinutes: number;
  thumbnail?: string;
};

export type Post = PostMeta & {
  html: string;
  toc: TocItem[];
  faq: FaqItem[];
};

function mdastToText(node: RootContent | Root): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return (node as { value: string }).value ?? "";
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => mdastToText(child)).join("");
  }
  return "";
}

function readingMinutesFor(markdown: string): number {
  // 日本語の目安読了速度(約400〜500字/分)から概算。最低1分。
  const chars = markdown.replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 450));
}

function listSlugFiles(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function readSource(filename: string): { data: PostFrontmatter; content: string; raw: string } {
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf-8");
  const { data, content } = matter(raw);
  return { data: data as PostFrontmatter, content, raw };
}

/**
 * 未解決の [[ID]] プレースホルダが残っていないかの機械チェック。
 * frontmatter(title/description 等)・本文の両方を含む生ファイル全体を対象にする
 * (本文だけを見ると title 等に紛れ込んだ場合を見逃すため)。
 * ビルド時(モジュール初回読み込み時)に走り、1件でも残っていれば例外で落として
 * リンク切れ・生の [[ ]] 表示がそのまま公開されるのを防ぐ。
 */
function assertNoUnresolvedPlaceholders(slug: string, raw: string) {
  const matches = raw.match(/\[\[[^\]]*\]\]/g);
  if (matches && matches.length > 0) {
    throw new Error(
      `[blog] 未解決の内部リンクプレースホルダが残っています: ${slug} -> ${matches.join(", ")}`
    );
  }
}

function extractHeadingText(node: Heading): string {
  return node.children.map((child) => mdastToText(child)).join("");
}

const FAQ_QUESTION_RE = /[?？]\s*$/;

function extractFaq(tree: Root): FaqItem[] {
  const faq: FaqItem[] = [];
  const children = tree.children;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type === "heading" && node.depth === 3) {
      const question = extractHeadingText(node).trim();
      if (!FAQ_QUESTION_RE.test(question)) continue;
      const answerParts: string[] = [];
      let j = i + 1;
      while (j < children.length && children[j].type !== "heading") {
        const text = mdastToText(children[j]).trim();
        if (text) answerParts.push(text);
        j++;
      }
      const answer = answerParts.join(" ").trim();
      if (answer) faq.push({ question, answer });
    }
  }
  return faq;
}

/**
 * H2見出しの目次を抽出する。rehype-slug と同じ github-slugger を
 * 「文書内の全見出しを出現順に通す」形で走らせ、id の採番(重複時の -1 等)が
 * 本文レンダリング側(rehype-slug)と完全に一致するようにしている。
 */
function extractToc(tree: Root): TocItem[] {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  for (const node of tree.children) {
    if (node.type === "heading") {
      const text = extractHeadingText(node);
      const id = slugger.slug(text);
      if (node.depth === 2) {
        toc.push({ id, text, depth: node.depth });
      }
    }
  }
  return toc;
}

function renderHtml(markdown: string): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .processSync(markdown);
  return String(file);
}

// gray-matter(js-yaml)は `written: 2026-07-15` のようなクォートなし日付を
// 自動的に JS の Date オブジェクトへ変換してしまうため、文字列に正規化する。
function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function buildPost(filename: string): Post {
  const slug = filename.replace(/\.md$/, "");
  const { data, content, raw } = readSource(filename);
  assertNoUnresolvedPlaceholders(slug, raw);

  const tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;

  return {
    slug,
    id: data.id,
    title: data.title,
    description: data.description,
    publishedAt: normalizeDate(data.written),
    cluster: data.cluster,
    clusterLabel: CLUSTER_LABELS[data.cluster] ?? data.cluster,
    priority: data.priority,
    readingMinutes: readingMinutesFor(content),
    thumbnail: data.thumbnail || undefined,
    html: renderHtml(content),
    toc: extractToc(tree),
    faq: extractFaq(tree),
  };
}

let cache: Post[] | null = null;

function loadAll(): Post[] {
  if (cache) return cache;
  cache = listSlugFiles().map(buildPost);
  return cache;
}

function displayRank(id: string): number {
  const idx = DISPLAY_ORDER.indexOf(id);
  return idx === -1 ? DISPLAY_ORDER.length : idx;
}

export function getAllPosts(): Post[] {
  return [...loadAll()].sort((a, b) => displayRank(a.id) - displayRank(b.id));
}

export function getAllPostsMeta(): PostMeta[] {
  return getAllPosts().map(
    ({ slug, id, title, description, publishedAt, cluster, clusterLabel, priority, readingMinutes, thumbnail }) => ({
      slug,
      id,
      title,
      description,
      publishedAt,
      cluster,
      clusterLabel,
      priority,
      readingMinutes,
      thumbnail,
    })
  );
}

export function getPostBySlug(slug: string): Post | undefined {
  return loadAll().find((p) => p.slug === slug);
}
