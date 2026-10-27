import type { Metadata, Route } from "next";
import Link from "next/link";

import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { HeartIcon, XIcon } from "@/components/shared/icons";
import { ProductCard } from "@/components/shared/product-card";
import { PagerLinks } from "@/features/catalog/components/list-results";
import {
  moveToCartForm,
  toggleFavoriteForm,
} from "@/features/favorites/actions";
import { getFavoritesPage } from "@/features/favorites/queries";
import { t } from "@/i18n";
import { pluralize } from "@/lib/format";

/** A blocking route, like /cart: rendered in full per request (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.favorites"),
  robots: { index: false, follow: true },
};

function FavoritesHead({ total }: { total?: number }) {
  return (
    <div className="lm-list-head">
      <h1>{t("pages.favorites")}</h1>
      {total !== undefined ? (
        <span className="lm-count">{pluralize(total, "products")}</span>
      ) : null}
    </div>
  );
}

function pageHref(page: number): Route {
  return (page <= 1 ? "/favorites" : `/favorites?page=${page}`) as Route;
}

/** Personal data: read per request (cookies), never cached. */
async function FavoritesContent({
  searchParams,
}: {
  searchParams: PageProps<"/favorites">["searchParams"];
}) {
  const raw = (await searchParams).page;
  const requested =
    typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  const data = await getFavoritesPage(Math.max(requested, 1));
  if (data.status === "unavailable") {
    return (
      <>
        <FavoritesHead />
        <EmptyState icon={<HeartIcon />} title={t("favorites.unavailable")} />
      </>
    );
  }
  if (data.total === 0) {
    return (
      <EmptyState
        icon={<HeartIcon />}
        title={t("favorites.emptyTitle")}
        text={t("favorites.emptyText")}
        action={
          <Link href="/new" className="lm-btn primary">
            {t("favorites.browseNew")}
          </Link>
        }
      />
    );
  }
  const here = pageHref(data.page);
  return (
    <>
      <FavoritesHead total={data.total} />
      <p className="lm-sub">{t("favorites.sub")}</p>
      <div className="lm-grid">
        {data.items.map((product) => (
          <div key={product.id}>
            <ProductCard product={product} currentPath={here} favorite />
            <div className="lm-l-actions">
              <form action={moveToCartForm} data-lm-form="move">
                <input type="hidden" name="product_id" value={product.id} />
                <input type="hidden" name="next" value={here} />
                <button
                  type="submit"
                  className="lm-btn primary sm"
                  disabled={!product.in_stock}
                >
                  {product.in_stock
                    ? t("favorites.moveToCart")
                    : t("product.out")}
                </button>
              </form>
              <form action={toggleFavoriteForm} data-lm-form="unfav">
                <input type="hidden" name="product_id" value={product.id} />
                <input type="hidden" name="slug" value={product.slug} />
                <input type="hidden" name="want" value="0" />
                <input type="hidden" name="next" value={here} />
                <button
                  type="submit"
                  className="lm-btn ghost sm"
                  aria-label={`${t("favorites.remove")}: ${product.name}`}
                >
                  <XIcon />
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {data.mode === "user" ? (
        <PagerLinks
          page={data.page}
          pages={Math.ceil(data.total / data.pageSize)}
          href={pageHref}
        />
      ) : null}
    </>
  );
}

/**
 * Favorites (prototype `pFavs()`): product cards with "انقل للسلة" and remove under
 * each. Logged in: GET /favorites, 24 per page; guests: every favorite in the cookie
 * (GET /products?ids=). Out-of-stock favorites stay listed.
 */
export default function FavoritesPage({
  searchParams,
}: PageProps<"/favorites">) {
  return (
    <PageChrome path="/favorites">
      <FavoritesContent searchParams={searchParams} />
    </PageChrome>
  );
}
