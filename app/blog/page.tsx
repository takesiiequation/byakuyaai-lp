import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllPostsMeta, CLUSTER_LABELS, type ClusterId, type PostMeta } from "../_lib/blog";
import { SiteHeader } from "../_components/SiteHeader";
import { SiteFooter } from "../_components/SiteFooter";

// 予約公開(publishAt)記事が、再デプロイなしで公開時刻後に自動で出てくるための ISR。
export const revalidate = 21600; // 6時間

export const metadata: Metadata = {
  title: "ブログ",
  description:
    "不動産会社の SNS 集客・AI 動画活用・外注比較・広告コンプライアンスに関する実務記事。",
  alternates: { canonical: "https://byakuyaai.com/blog" },
  openGraph: {
    title: "ブログ | ByakuyaAI",
    description:
      "不動産会社の SNS 集客・AI 動画活用・外注比較・広告コンプライアンスに関する実務記事。",
    type: "website",
    url: "https://byakuyaai.com/blog",
  },
};

// 表示するクラスターの並び順(掲載中の記事があるものだけ表示される)
const CLUSTER_ORDER: ClusterId[] = ["A", "B", "C", "D", "E", "F", "G"];

export default function BlogIndexPage() {
  const posts = getAllPostsMeta();
  const clusters = CLUSTER_ORDER.filter((c) => posts.some((p) => p.cluster === c));

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white via-[var(--brand-cream)]/40 to-white">
      <SiteHeader />
      <section className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold tracking-[0.25em] text-[var(--brand-orange)]">
              BLOG
            </p>
            <h1 className="text-2xl font-black text-[var(--brand-ink)] sm:text-3xl lg:text-4xl">
              不動産 × AI × SNS のヒント集
            </h1>
            <p className="mt-3 text-sm text-[var(--brand-gray)] sm:text-base">
              現場で使える集客ノウハウ・外注比較・広告コンプライアンスの実務記事をお届けします。
            </p>
          </div>

          {clusters.map((cluster) => (
            <div key={cluster} className="mb-12 last:mb-0">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-[var(--brand-ink)] sm:text-base">
                <span className="inline-block h-4 w-1.5 rounded-full bg-[var(--brand-orange)]" />
                {CLUSTER_LABELS[cluster]}
              </h2>
              <ul className="grid gap-5 sm:gap-6">
                {posts
                  .filter((p) => p.cluster === cluster)
                  .map((post) => (
                    <li key={post.slug}>
                      <PostCard post={post} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-orange)]/60 hover:shadow-md"
    >
      {post.thumbnail && (
        <div className="relative aspect-[1200/630] w-full overflow-hidden bg-[var(--brand-cream)]">
          <Image
            src={post.thumbnail}
            alt=""
            fill
            sizes="(min-width: 640px) 640px, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="p-5 sm:p-7">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--brand-gray-light)] sm:text-xs">
          <span className="rounded-full bg-[var(--brand-cream)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
            {post.clusterLabel}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span>約{post.readingMinutes}分で読めます</span>
        </div>
        <h3 className="mb-2 text-lg font-black leading-snug text-[var(--brand-ink)] transition group-hover:text-[var(--brand-orange-dark)] sm:text-xl">
          {post.title}
        </h3>
        <p className="text-sm leading-relaxed text-[var(--brand-gray)]">
          {post.description}
        </p>
      </div>
    </Link>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
