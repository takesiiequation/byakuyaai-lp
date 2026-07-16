import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPostsMeta, getPostBySlug } from "../../_lib/blog";
import { SiteHeader } from "../../_components/SiteHeader";
import { SiteFooter } from "../../_components/SiteFooter";

const SITE_URL = "https://byakuyaai.com";

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
  const url = `${SITE_URL}/blog/${post.slug}`;
  const ogImage = post.thumbnail ? `${SITE_URL}${post.thumbnail}` : undefined;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.publishedAt,
      authors: ["ByakuyaAI"],
      url,
      siteName: "ByakuyaAI",
      locale: "ja_JP",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(ogImage ? { images: [ogImage] } : {}),
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

  const url = `${SITE_URL}/blog/${post.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "ByakuyaAI", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "ByakuyaAI",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "ja-JP",
  };

  const faqJsonLd =
    post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <SiteHeader />

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
              <span className="rounded-full bg-[var(--brand-cream)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                {post.clusterLabel}
              </span>
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden>·</span>
              <span>約{post.readingMinutes}分で読めます</span>
            </div>
            <h1 className="text-2xl font-black leading-tight text-[var(--brand-ink)] sm:text-3xl lg:text-4xl">
              {post.title}
            </h1>
          </div>

          {post.thumbnail && (
            <div className="relative mb-10 aspect-[1200/630] w-full overflow-hidden rounded-2xl bg-[var(--brand-cream)]">
              <Image
                src={post.thumbnail}
                alt=""
                fill
                priority
                sizes="(min-width: 672px) 672px, 100vw"
                className="object-cover"
              />
            </div>
          )}

          {post.toc.length > 1 && (
            <nav
              aria-label="目次"
              className="mb-10 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 p-5 sm:p-6"
            >
              <p className="mb-3 text-xs font-bold tracking-widest text-[var(--brand-orange-dark)]">
                目次
              </p>
              <ol className="space-y-2 text-sm">
                {post.toc.map((item, i) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="text-[var(--brand-gray)] transition hover:text-[var(--brand-orange-dark)]"
                    >
                      {i + 1}. {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div
            className="prose-custom"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

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

      <SiteFooter />
    </main>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
