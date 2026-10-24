"use client";

import type { ImageLoaderProps } from "next/image";

import { buildImageUrl, SIZE_SUFFIX, sizeForWidth } from "@/lib/image-urls";

/**
 * next/image loader for backend images (configured as `images.loaderFile`). The site's
 * own components render backend images with `BackendImage` (server, no client code);
 * this loader keeps `next/image` correct if it is ever used for backend images.
 *
 * `src` may be:
 * - a base key (`products/42/3f9c…e1`),
 * - a URL the backend returned for any size (`…/products/42/3f9c…e1_medium.webp`),
 * - a local path (`/icon.svg`), which is returned unchanged.
 */
export default function lamsaImageLoader({
  src,
  width,
}: ImageLoaderProps): string {
  const size = sizeForWidth(width);
  if (SIZE_SUFFIX.test(src)) return src.replace(SIZE_SUFFIX, `_${size}.webp`);
  if (
    src.startsWith("/") ||
    /^[a-z]+:\/\//i.test(src) ||
    src.startsWith("data:")
  )
    return src;
  return buildImageUrl(src, size);
}
