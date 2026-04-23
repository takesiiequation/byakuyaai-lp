import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPostsMeta, getPostBySlug } from "../../_data/posts";

export function generateStaticParams() {
  return getAllPostsMeta().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://byakuyaai.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      url: `https://byakuyaai.com/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "ByakuyaAI" },
    publisher: {
      "@type": "Organization",
      name: "ByakuyaAI",
      logo: {
        "@type": "ImageObject",
        url: "https://byakuyaai.com/logo.png",
      },
    },
    mainEntityOfPage: `https://byakuyaai.com/blog/${post.slug}`,
  };

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BlogHeader />

      <article className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <Link
              href="/blog"
              className="text-xs font-bold text-[var(--brand-orange)] hover:underline sm:text-sm"
            >
              ← ブログ一覧
            </Link>
          </div>

          <div className="mb-8 border-b border-[var(--brand-border)] pb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--brand-gray-light)] sm:text-xs">
              <time dateTime={post.publishedAt}>
                {formatDate(post.publishedAt)}
              </time>
              <span aria-hidden>·</span>
              <span>約{post.readingMinutes}分で読めます</span>
            </div>
            <h1 className="text-2xl font-black leading-tight text-[var(--brand-ink)] sm:text-3xl lg:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--brand-cream)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <div className="prose-custom">{post.body()}</div>

          <div className="mt-12 rounded-2xl border border-[var(--brand-orange)]/30 bg-[var(--brand-cream)]/40 p-6 text-center sm:p-8">
            <p className="mb-3 text-sm font-bold text-[var(--brand-ink)]">
              ByakuyaAI は 14 日間の無料トライアルからご利用いただけます
            </p>
            <Link
              href="/#contact"
              className="inline-flex items-center rounded-full bg-[var(--brand-orange)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-orange-dark)]"
            >
              無料トライアルを試す →
            </Link>
          </div>
        </div>
      </article>

      <BlogFooter />
    </main>
  );
}

function BlogHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
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
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <p>© ByakuyaAI · info@byakuyaai.com</p>
      </div>
    </footer>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
