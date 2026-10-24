import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** Personal and transactional pages are kept out of search engines. */
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
        "/login",
        "/register",
        "/complete-profile",
        "/search",
        "/api/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
