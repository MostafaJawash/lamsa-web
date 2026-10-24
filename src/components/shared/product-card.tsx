import Link from "next/link";

import type { ProductCard as ProductCardData } from "@/features/catalog/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { HeartIcon } from "./icons";
import { Price } from "./price";
import { ProductSilhouette } from "./product-art";
import { SafeImage } from "./safe-image";

/** Card widths: rail columns are 146px on mobile, up to 190px on desktop. */
export const CARD_IMAGE_SIZES = "(max-width: 767px) 146px, 190px";

type ProductCardProps = {
  product: ProductCardData;
  /** Where the visitor is now, for the favorites heart (`/login?next=`). */
  currentPath: string;
  /** Load the image early (cards above the fold, e.g. the LCP image on mobile). */
  preload?: boolean;
};

/** Prototype `card()`. The whole card links to the product; the heart sits on top. */
export function ProductCard({
  product,
  currentPath,
  preload = false,
}: ProductCardProps) {
  const soldOut = !product.in_stock;
  const silhouette = <ProductSilhouette />;
  return (
    <article className={cn("lm-card", soldOut && "out")}>
      <Link
        href={`/p/${encodeURIComponent(product.slug)}`}
        className="lm-card-link"
      >
        <span className="lm-art">
          {product.image ? (
            <SafeImage
              src={product.image.medium}
              alt={product.name}
              sizes={CARD_IMAGE_SIZES}
              preload={preload}
              fallback={silhouette}
            />
          ) : (
            silhouette
          )}
        </span>
        <span className="lm-badges">
          {product.is_new ? (
            <i className="lm-bd new">{t("card.isNew")}</i>
          ) : null}
          {product.discount_percent ? (
            <i className="lm-bd off">
              {t("card.discount", { percent: product.discount_percent })}
            </i>
          ) : null}
          {soldOut ? <i className="lm-bd na">{t("card.soldOut")}</i> : null}
        </span>
        {product.brand ? (
          <span className="c-brand">{product.brand.name}</span>
        ) : null}
        <span className="c-name">{product.name}</span>
        <span className="c-price">
          <Price price={product.price} compareAt={product.compare_at_price} />
        </span>
        {product.swatches.length > 0 ? (
          <span className="c-dots" role="img" aria-label={t("card.colors")}>
            {product.swatches.map((swatch) => (
              <i
                key={`${swatch.hex}-${swatch.name}`}
                title={swatch.name}
                style={{ background: swatch.hex }}
              />
            ))}
          </span>
        ) : null}
      </Link>
      <Link
        href={{ pathname: "/login", query: { next: currentPath } }}
        className="lm-fav"
        aria-label={t("card.addFavorite")}
      >
        <HeartIcon />
      </Link>
    </article>
  );
}
