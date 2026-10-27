import Link from "next/link";

import type { ProductCard as ProductCardData } from "@/features/catalog/types";
import { HeartForm } from "@/features/favorites/components/heart-form";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { BackendImage } from "./backend-image";
import { Price } from "./price";
import { ProductSilhouette } from "./product-art";

/** Card widths: rail columns are 146px on mobile, up to 190px on desktop. */
export const CARD_IMAGE_SIZES = "(max-width: 767px) 146px, 190px";

/**
 * Discount badge, e.g. "−25٪" (U+2212 minus, Arabic percent sign as in the prototype),
 * as an isolated LTR run so the sign stays in front of the number inside RTL text.
 */
export function DiscountBadge({ percent }: { percent: number }) {
  return (
    <i className="lm-bd off lm-num" dir="ltr">
      {t("card.discount", { percent })}
    </i>
  );
}

type ProductCardProps = {
  product: ProductCardData;
  /** Where the visitor is now: the heart comes back here without JavaScript. */
  currentPath: string;
  /** Favorite state when known on the server (favorites page); else the controller sets it. */
  favorite?: boolean;
  /** Load the image early (cards above the fold, e.g. the LCP image on mobile). */
  preload?: boolean;
};

/**
 * Prototype `card()`. The whole card links to the product; the heart sits on top.
 * Server-only and cacheable (no visitor data): the image fallback works without client
 * code (see BackendImage), and the heart is a form whose state the one client
 * controller fills in (see HeartForm).
 */
export function ProductCard({
  product,
  currentPath,
  favorite = false,
  preload = false,
}: ProductCardProps) {
  const soldOut = !product.in_stock;
  return (
    <article className={cn("lm-card", soldOut && "out")}>
      <Link
        href={`/p/${encodeURIComponent(product.slug)}`}
        className="lm-card-link"
      >
        <span className="lm-art">
          <ProductSilhouette />
          {product.image ? (
            <BackendImage
              urls={product.image}
              alt={product.name}
              sizes={CARD_IMAGE_SIZES}
              priority={preload}
            />
          ) : null}
        </span>
        <span className="lm-badges">
          {product.is_new ? (
            <i className="lm-bd new">{t("card.isNew")}</i>
          ) : null}
          {product.discount_percent ? (
            <DiscountBadge percent={product.discount_percent} />
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
      <HeartForm
        productId={product.id}
        slug={product.slug}
        next={currentPath}
        pressed={favorite}
      />
    </article>
  );
}
