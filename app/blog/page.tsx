import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllPostsMeta } from "../_data/posts";

export const metadata: Metadata = {
  title: "ブログ",
  description:
    "不動産会社の SNS 集客・AI 動画活用・運用効率化に関する実務記事。",
  alternates: { canonical: "https://byakuyaai.com/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPostsMeta();

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-white via-[var(--brand-cream)]/40 to-white">
      <BlogHeader />
      <section className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-bold tracking-[0.25em] text-[var(--brand-orange)]">
              BLOG
            </p>
            <h1 className="text-2xl font-black text-[var(--brand-ink)] sm:text-3xl lg:text-4xl">
              不動産 × AI × SNS のヒント集
            </h1>
            <p className="mt-3 text-sm text-[var(--brand-gray)] sm:text-base">
              現場で使える集客ノウハウと AI 活用の実務記事をお届けします。
            </p>
          </div>

          <ul className="grid gap-5 sm:gap-6">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-[var(--brand-border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-orange)]/60 hover:shadow-md sm:p-7"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--brand-gray-light)] sm:text-xs">
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt)}
                    </time>
                    <span aria-hidden>·</span>
                    <span>約{post.readingMinutes}分で読めます</span>
                  </div>
                  <h2 className="mb-2 text-lg font-black leading-snug text-[var(--brand-ink)] transition group-hover:text-[var(--brand-orange-dark)] sm:text-xl">
                    {post.title}
                  </h2>
                  <p className="mb-3 text-sm leading-relaxed text-[var(--brand-gray)]">
                    {post.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--brand-cream)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <BlogFooter />
    </main>
  );
}

function BlogHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="ByakuyaAI"
            width={120}
            height={36}
            className="h-8 w-auto"
          />
        </Link>
        <Link
          href="/"
          className="text-xs font-bold text-[var(--brand-gray)] transition hover:text-[var(--brand-orange)] sm:text-sm"
        >
          ← トップへ戻る
        </Link>
      </div>
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="border-t border-[var(--brand-border)] bg-white py-8 text-center text-xs text-[var(--brand-gray-light)]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <p>© ByakuyaAI · info@byakuyaai.com</p>
      </div>
    </footer>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
