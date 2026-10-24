import type { Route } from "next";
import Link from "next/link";

import type { ImageUrls } from "@/features/catalog/types";

import { ProductSilhouette } from "./product-art";
import { SafeImage } from "./safe-image";

/** Tiles fill 1/2 of the page on mobile, up to ~360px on desktop. */
const TILE_IMAGE_SIZES = "(max-width: 767px) 45vw, 360px";

/**
 * Desktop columns for n tiles, so no tile is left alone on a row: 1–4 tiles → one row;
 * 5–8 → two balanced rows; more → 4 per row. Mobile always uses 2 columns (CSS).
 */
export function tileColumns(count: number): number {
  if (count <= 4) return Math.max(count, 1);
  if (count <= 8) return Math.ceil(count / 2);
  return 4;
}

export function CategoryTiles({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="lm-cat-tiles"
      style={{ "--cols": tileColumns(count) } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** Prototype `.cat-tile`: picture tile + label. `art` replaces the image (e.g. a logo). */
export function CategoryTile({
  href,
  label,
  image,
  art,
}: {
  href: Route;
  label: string;
  image?: ImageUrls | null;
  art?: React.ReactNode;
}) {
  const silhouette = <ProductSilhouette />;
  return (
    <Link href={href} className="lm-cat-tile">
      {art ?? (
        <span className="lm-art">
          {image ? (
            <SafeImage
              src={image.medium}
              alt=""
              sizes={TILE_IMAGE_SIZES}
              fallback={silhouette}
            />
          ) : (
            silhouette
          )}
        </span>
      )}
      <span>{label}</span>
    </Link>
  );
}
