import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Personal and transactional pages are kept out of search engines. /login and
 * /register stay crawlable: they hold nothing personal, and people search for
 * "<store> login" (a blocked page also fails Lighthouse SEO).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/cart",
        "/checkout",
        "/favorites",
        "/complete-profile",
        "/search",
        "/api/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
