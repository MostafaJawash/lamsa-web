import { publicEnv } from "@/lib/env.public";

/**
 * Backend image URLs (shared by server and client code).
 *
 * The backend stores every image as WebP in three sizes (longest side, never upscaled):
 * `<key>_thumb.webp` (300), `<key>_medium.webp` (800) and `<key>_large.webp` (1600),
 * where `<key>` is the stored base key, e.g. `products/42/3f9c…e1`. Next.js never
 * re-optimizes them.
 */
export const IMAGE_SIZES = { thumb: 300, medium: 800, large: 1600 } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;

/** The `{thumb, medium, large}` object the backend returns for `image` / `logo`. */
export type ImageUrls = Record<ImageSize, string>;

export const SIZE_SUFFIX = /_(thumb|medium|large)\.webp$/;

export function sizeForWidth(width: number): ImageSize {
  if (width <= IMAGE_SIZES.thumb) return "thumb";
  if (width <= IMAGE_SIZES.medium) return "medium";
  return "large";
}

/** Full URL of one size for a base key, e.g. `buildImageUrl("products/42/abc", "thumb")`. */
export function buildImageUrl(
  imageKey: string,
  size: ImageSize,
  mediaBaseUrl: string = publicEnv.NEXT_PUBLIC_MEDIA_BASE_URL,
): string {
  const key = imageKey.replace(/^\/+/, "").replace(SIZE_SUFFIX, "");
  return `${mediaBaseUrl}/${key}_${size}.webp`;
}

/** Picks the best URL from a backend `{thumb, medium, large}` object. */
export function pickImageUrl(urls: ImageUrls, width: number): string {
  return urls[sizeForWidth(width)];
}

/** `srcset` listing the three real files with their widths: "…_thumb.webp 300w, …". */
export function srcSetFor(urls: ImageUrls): string {
  return (Object.keys(IMAGE_SIZES) as ImageSize[])
    .map((size) => `${urls[size]} ${IMAGE_SIZES[size]}w`)
    .join(", ");
}
