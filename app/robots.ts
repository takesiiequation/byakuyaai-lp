import type { MetadataRoute } from "next";

const SITE_URL = "https://byakuyaai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /me is Okamoto's private tracker (PIN-gated). The pages already send
        // noindex, but keeping crawlers out of the path entirely means the URL
        // never shows up in a "site:" listing either.
        disallow: ["/me", "/me/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
