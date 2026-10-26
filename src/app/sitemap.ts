import type { MetadataRoute } from "next";

import { laterPages, pagedPath } from "@/features/catalog/filters";
import { getCatalogIndex } from "@/features/catalog/queries";
import { absoluteUrl } from "@/features/catalog/seo";

const STATIC_PATHS = ["/", "/new", "/sale", "/brands", "/categories"] as const;

/**
 * Sitemap from the API: the static shop pages, every visible category, brand and product,
 * and list pages 2+ (`/page/[n]`). Bounded and cached for an hour (see getCatalogIndex);
 * falls back to the static pages when the backend is unavailable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path === "/" ? "" : path),
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
  const index = await getCatalogIndex();
  if (index.status !== "ok") return entries;
  const { categories, brands, products, newCount, saleCount } = index.data;
  const add = (path: string, priority: number) =>
    entries.push({
      url: absoluteUrl(path),
      changeFrequency: "daily",
      priority,
    });
  const addPages = (base: string, count: number) => {
    for (const n of laterPages(count)) add(pagedPath(base, n), 0.4);
  };
  addPages("/new", newCount);
  addPages("/sale", saleCount);
  for (const c of categories) {
    const base = `/c/${encodeURIComponent(c.slug)}`;
    add(base, 0.8);
    addPages(base, c.count);
  }
  for (const b of brands) {
    const base = `/brands/${encodeURIComponent(b.slug)}`;
    add(base, 0.6);
    addPages(base, b.count);
  }
  for (const p of products) add(`/p/${encodeURIComponent(p.slug)}`, 0.6);
  return entries;
}
