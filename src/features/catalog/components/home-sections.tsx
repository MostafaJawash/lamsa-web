import type { Route } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/shared/brand-logo";
import { CategoryTile, CategoryTiles } from "@/components/shared/category-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon } from "@/components/shared/icons";
import { ProductCard } from "@/components/shared/product-card";
import { Section } from "@/components/shared/section";
import {
  ALL_PRODUCTS_HREF,
  GIFTS_CATEGORY_SLUG,
  GIFTS_HREF,
} from "@/config/site";
import { t } from "@/i18n";

import { getGiftsEntry } from "../gifts";
import {
  getBrands,
  getCategoryTiles,
  getNewArrivals,
  getOnSale,
} from "../queries";

/** Rail (prototype `rail()`) or, without products, the section header + an empty state. */
async function ProductRailSection({
  kind,
  currentPath,
}: {
  kind: "new" | "sale";
  currentPath: string;
}) {
  const isNew = kind === "new";
  const result = await (isNew ? getNewArrivals() : getOnSale());
  const title = t(isNew ? "home.newArrivals" : "home.onSale");
  if (result.status !== "ok") {
    return (
      <Section title={title}>
        <EmptyState
          icon={<BagIcon />}
          title={t(isNew ? "home.emptyNew" : "home.emptySale")}
        />
      </Section>
    );
  }
  return (
    <Section
      title={title}
      more={{ href: isNew ? "/new" : "/sale", label: t("home.seeAll") }}
    >
      <div className="lm-rail">
        {result.data.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            currentPath={currentPath}
            // The first rail is above the fold; on phones its first card is the LCP image.
            preload={isNew && index < 2}
          />
        ))}
      </div>
    </Section>
  );
}

export function NewArrivalsSection({ currentPath }: { currentPath: string }) {
  return <ProductRailSection kind="new" currentPath={currentPath} />;
}

export function OnSaleSection({ currentPath }: { currentPath: string }) {
  return <ProductRailSection kind="sale" currentPath={currentPath} />;
}

/**
 * "تسوّق حسب القسم": "كل المنتجات" first, then the gift boxes (the backend category's own
 * name), then the other top-level categories with products. The categories can fail or be
 * empty without losing the "كل المنتجات" tile.
 */
export async function CategoryTilesSection() {
  const [categories, gifts, newest] = await Promise.all([
    getCategoryTiles(),
    getGiftsEntry(),
    getNewArrivals(),
  ]);
  const others =
    categories.status === "ok"
      ? categories.data.filter(({ slug }) => slug !== GIFTS_CATEGORY_SLUG)
      : [];
  const allImage =
    newest.status === "ok" ? (newest.data[0]?.image ?? null) : null;
  return (
    <Section title={t("home.byCategory")}>
      <CategoryTiles count={others.length + (gifts ? 2 : 1)}>
        <CategoryTile
          href={ALL_PRODUCTS_HREF}
          label={t("nav.allProducts")}
          image={allImage}
        />
        {gifts ? (
          <CategoryTile
            href={GIFTS_HREF}
            label={gifts.label}
            image={gifts.image}
          />
        ) : null}
        {others.map((category) => (
          <CategoryTile
            key={category.id}
            href={`/c/${encodeURIComponent(category.slug)}` as Route}
            label={category.name}
            image={category.image}
          />
        ))}
      </CategoryTiles>
    </Section>
  );
}

/** "الماركات" (prototype `.brand-row`); hidden when there are no brands. */
export async function BrandsSection() {
  const result = await getBrands();
  if (result.status !== "ok") return null;
  return (
    <Section
      title={t("home.brands")}
      more={{ href: "/brands", label: t("home.allBrands") }}
    >
      <div className="lm-brand-row">
        {result.data.map((brand) => (
          <Link
            key={brand.id}
            href={`/brands/${encodeURIComponent(brand.slug)}`}
            className="lm-brand-chip"
          >
            <BrandLogo id={brand.id} name={brand.name} logo={brand.logo} />
            <span>{brand.name}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
