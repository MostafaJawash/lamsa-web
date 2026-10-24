import { BrandLogo } from "@/components/shared/brand-logo";
import { CategoryTile, CategoryTiles } from "@/components/shared/category-tile";
import { mainNav } from "@/config/site";
import { t } from "@/i18n";

import {
  getBrands,
  getCategoryTiles,
  getNewArrivals,
  getOnSale,
} from "../queries";
import type { ImageUrls } from "../types";

/**
 * Prototype `pCats()`: tiles for جديد، مكياج، عناية وعطور، شعر، تنزيلات, then ماركات.
 * Pictures come from the backend when available (category image, else a product image);
 * every tile renders even when the backend is down.
 */
export async function CategoriesGrid() {
  const [newArrivals, onSale, categories, brands] = await Promise.all([
    getNewArrivals(),
    getOnSale(),
    getCategoryTiles(),
    getBrands(),
  ]);

  const imageFor = (href: string): ImageUrls | null => {
    if (href === "/new")
      return newArrivals.status === "ok"
        ? (newArrivals.data[0]?.image ?? null)
        : null;
    if (href === "/sale")
      return onSale.status === "ok" ? (onSale.data[0]?.image ?? null) : null;
    if (categories.status !== "ok") return null;
    const slug = href.replace(/^\/c\//, "");
    return (
      categories.data.find((category) => category.slug === slug)?.image ?? null
    );
  };

  const tiles = mainNav.filter((item) => item.href !== "/brands");
  const firstBrand = brands.status === "ok" ? brands.data[0] : undefined;

  return (
    <CategoryTiles count={tiles.length + 1}>
      {tiles.map((item) => (
        <CategoryTile
          key={item.href}
          href={item.href}
          label={t(item.labelKey)}
          image={imageFor(item.href)}
        />
      ))}
      <CategoryTile
        href="/brands"
        label={t("nav.brands")}
        art={
          <span
            className="lm-art"
            style={
              {
                "--tint": "#E3C9D6",
                display: "grid",
                placeItems: "center",
              } as React.CSSProperties
            }
          >
            <BrandLogo
              id={firstBrand?.id ?? 0}
              name={firstBrand?.name ?? t("site.name")}
              logo={firstBrand?.logo ?? null}
              large
            />
          </span>
        }
      />
    </CategoryTiles>
  );
}
