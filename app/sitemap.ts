import type { MetadataRoute } from "next";
import { getAllPostsMeta } from "./_lib/blog";

const SITE_URL = "https://byakuyaai.com";

// 予約公開(publishAt)記事が、再デプロイなしで公開時刻後に自動で出てくるための ISR。
export const revalidate = 21600; // 6時間

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts = getAllPostsMeta();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/tos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/tokushoho`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
