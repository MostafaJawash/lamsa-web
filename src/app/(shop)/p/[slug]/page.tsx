import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
import { BackendImage } from "@/components/shared/backend-image";
import { EmptyState } from "@/components/shared/empty-state";
import {
  BagIcon,
  CashIcon,
  StoreIcon,
  TruckIcon,
} from "@/components/shared/icons";
import { JsonLd } from "@/components/shared/json-ld";
import { ProductCard } from "@/components/shared/product-card";
import { ProductSilhouette } from "@/components/shared/product-art";
import { Section } from "@/components/shared/section";
import { RailSkeleton } from "@/components/shared/skeletons";
import { tabForCategory } from "@/config/site";
import { Crumbs } from "@/features/catalog/components/crumbs";
import { ProductPurchase } from "@/features/catalog/components/product-purchase";
import {
  getCatalogIndex,
  getProduct,
  getRelated,
} from "@/features/catalog/queries";
import {
  breadcrumbJsonLd,
  productJsonLd,
  productMetadata,
} from "@/features/catalog/seo";
import type { ProductDetail } from "@/features/catalog/types";
import {
  defaultVariantId,
  variantFromParam,
} from "@/features/catalog/variants";
import { t } from "@/i18n";

/** Product shells prerendered for the catalog index (bounded, see getCatalogIndex). */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const index = await getCatalogIndex();
  const slugs = index.status === "ok" ? index.data.products : [];
  return slugs.length ? slugs : [{ slug: "product" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProduct(slug);
  return result.status === "ok"
    ? productMetadata(result.data)
    : { title: t("pages.product") };
}

/**
 * Prototype `.perks`. TODO: read the free-shipping threshold from the backend once a
 * public endpoint exposes it (today only the cart's delivery quotes do).
 */
function Perks() {
  return (
    <ul className="lm-perks">
      <li>
        <TruckIcon />
        {t("product.perkShipping")}
      </li>
      <li>
        <StoreIcon />
        {t("product.perkPickup")}
      </li>
      <li>
        <CashIcon />
        {t("product.perkCash")}
      </li>
    </ul>
  );
}

/** Reads `?v` (URL data) and renders the purchase area with that variant selected. */
async function PurchaseFromUrl({
  product,
  searchParams,
}: {
  product: ProductDetail;
  searchParams: PageProps<"/p/[slug]">["searchParams"];
}) {
  const params = await searchParams;
  const selected =
    variantFromParam(product, params.v) ?? defaultVariantId(product);
  return (
    <ProductPurchase
      product={product}
      initialVariantId={selected}
      perks={<Perks />}
    />
  );
}

async function RelatedRail({ slug }: { slug: string }) {
  const result = await getRelated(slug);
  if (result.status !== "ok") return null;
  return (
    <Section title={t("product.related")}>
      <div className="lm-rail">
        {result.data.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            currentPath={`/p/${slug}`}
          />
        ))}
      </div>
    </Section>
  );
}

function BundleContents({ product }: { product: ProductDetail }) {
  if (product.items.length === 0) return null;
  return (
    <Section title={t("product.bundleTitle")}>
      <div className="lm-bundle">
        {product.items.map((item) => (
          <Link
            key={`${item.product.id}-${item.variant_label ?? ""}`}
            href={`/p/${encodeURIComponent(item.product.slug)}` as Route}
            className="lm-mini"
          >
            <span className="lm-art">
              <ProductSilhouette />
              {item.product.image ? (
                <BackendImage urls={item.product.image} alt="" sizes="44px" />
              ) : null}
            </span>
            <span>
              {item.product.name}
              {item.variant_label ? (
                <>
                  <br />
                  <small>{item.variant_label}</small>
                </>
              ) : null}
            </span>
            <b className="lm-num" dir="ltr">
              ×{item.quantity}
            </b>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/** Product page (prototype `pProduct()`). */
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const result = await getProduct(slug);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <PageChrome path="/p/[slug]">
        <EmptyState
          icon={<BagIcon />}
          title={t("product.unavailable")}
          text={t("list.unavailableText")}
        />
      </PageChrome>
    );
  }
  const product = result.data;
  const category = product.category;
  const topSlug = product.breadcrumb[0]?.slug ?? category.slug;
  const categoryPath = `/c/${encodeURIComponent(category.slug)}`;
  return (
    <PageChrome
      path="/p/[slug]"
      title={product.name}
      activeTab={tabForCategory(topSlug)}
    >
      <Crumbs
        items={[
          { name: t("product.crumbHome"), href: "/" },
          { name: category.name, href: categoryPath as Route },
          { name: product.name, href: null },
        ]}
      />
      <Suspense
        fallback={
          <ProductPurchase
            product={product}
            initialVariantId={defaultVariantId(product)}
            perks={<Perks />}
          />
        }
      >
        <PurchaseFromUrl product={product} searchParams={searchParams} />
      </Suspense>
      <BundleContents product={product} />
      <Suspense
        fallback={
          <Section title={t("product.related")}>
            <RailSkeleton />
          </Section>
        }
      >
        <RelatedRail slug={product.slug} />
      </Suspense>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("product.crumbHome"), path: "/" },
          { name: category.name, path: categoryPath },
          {
            name: product.name,
            path: `/p/${encodeURIComponent(product.slug)}`,
          },
        ])}
      />
    </PageChrome>
  );
}
