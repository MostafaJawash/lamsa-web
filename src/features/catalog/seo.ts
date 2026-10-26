import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

import { pagedPath } from "./filters";
import type { ProductDetail } from "./types";

/** Absolute URL on this site. */
export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** One line of at most `max` characters, cut at a word boundary. */
export function trimDescription(
  text: string | null | undefined,
  max = 160,
): string {
  const plain = (text ?? "").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** List canonical: filters, sort and q dropped; only the page kept ("/c/care/page/2"). */
export function listCanonical(basePath: string, page: number): string {
  return pagedPath(basePath, page);
}

/**
 * Metadata of a list page (category, brand, new, sale, search). A blank description
 * (the backend may send "") falls back to "<title> | <site description>".
 */
export function listMetadata({
  title,
  description,
  basePath,
  page,
  index = true,
  image,
}: {
  title: string;
  description: string;
  basePath: string;
  page: number;
  index?: boolean;
  image?: string | null;
}): Metadata {
  const canonical = listCanonical(basePath, page);
  const text =
    trimDescription(description) ||
    trimDescription(`${title} | ${siteConfig.description}`);
  return {
    title,
    description: text,
    alternates: { canonical },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description: text,
      url: canonical,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

/** Metadata of a product page: name, trimmed description, canonical, main image (large). */
export function productMetadata(product: ProductDetail): Metadata {
  const path = `/p/${encodeURIComponent(product.slug)}`;
  const description =
    trimDescription(product.description) || trimDescription(product.name);
  const image = product.images[0]?.urls.large ?? product.image?.large ?? null;
  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: path,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

type JsonLd = Record<string, unknown>;

const AVAILABILITY = {
  in_stock: "https://schema.org/InStock",
  low: "https://schema.org/LimitedAvailability",
  out: "https://schema.org/OutOfStock",
} as const;

/** schema.org Product with an Offer, or an AggregateOffer for variable products. */
export function productJsonLd(product: ProductDetail): JsonLd {
  const url = absoluteUrl(`/p/${encodeURIComponent(product.slug)}`);
  const images = product.images.length
    ? product.images.map((image) => image.urls.large)
    : product.image
      ? [product.image.large]
      : [];
  let offers: JsonLd;
  if (product.type === "variable" && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.current_price));
    const available = product.variants.some((v) => v.stock_status !== "out");
    offers = {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: product.variants.length,
      availability: available ? AVAILABILITY.in_stock : AVAILABILITY.out,
      url,
    };
  } else {
    const status =
      product.stock_status ?? (product.in_stock ? "in_stock" : "out");
    offers = {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: product.current_price ?? product.price,
      availability: AVAILABILITY[status],
      url,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(images.length ? { image: images } : {}),
    ...(product.description
      ? { description: trimDescription(product.description, 500) }
      : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand.name } }
      : {}),
    // sku: not exposed by the public API (admin only).
    offers,
    url,
  };
}

/** schema.org BreadcrumbList from (name, path) pairs, home first. */
export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
