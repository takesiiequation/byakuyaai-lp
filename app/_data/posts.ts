import type { ReactNode } from "react";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingMinutes: number;
  tags: string[];
};

export type Post = PostMeta & {
  body: () => ReactNode;
};

import { realEstateSnsAiGuide2026 } from "./posts/real-estate-sns-ai-guide-2026";

export const posts: Post[] = [realEstateSnsAiGuide2026];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllPostsMeta(): PostMeta[] {
  return [...posts]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map(({ slug, title, description, publishedAt, readingMinutes, tags }) => ({
      slug,
      title,
      description,
      publishedAt,
      readingMinutes,
      tags,
    }));
}
