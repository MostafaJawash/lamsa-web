import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Placeholder sitemap: static shop pages only.
 * TODO: add categories, brands and products from the backend (catalog queries).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...siteConfig.mainNav.map((item) => item.href)];
  return paths.map((path) => ({
    url: `${siteConfig.url}${path === "/" ? "" : path}`,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
