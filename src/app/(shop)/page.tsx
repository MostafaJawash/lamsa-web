import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { BagIcon, SearchIcon } from "@/components/shared/icons";
import { Section } from "@/components/shared/section";
import { SectionBoundary } from "@/components/shared/section-boundary";
import {
  BannersSkeleton,
  BrandsSkeleton,
  RailSkeleton,
  TilesSkeleton,
} from "@/components/shared/skeletons";
import { mainNav, SALE_HREF } from "@/config/site";
import {
  FallbackBanners,
  HomeBanners,
} from "@/features/banners/components/home-banners";
import {
  BrandsSection,
  CategoryTilesSection,
  NewArrivalsSection,
  OnSaleSection,
} from "@/features/catalog/components/home-sections";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const HOME_PATH = "/";

/**
 * Home (prototype `pHome()`). Every section loads on its own: a Suspense skeleton of the
 * same size while loading, its own error boundary, and an empty/fallback state from the
 * query result, so the page always renders.
 */
export default function HomePage() {
  const failed = <p className="sr-only">{t("home.sectionFailed")}</p>;
  return (
    <>
      <h1 className="sr-only">{t("home.title")}</h1>

      {/* Mobile only: fake search field + category chips */}
      <div className="md:hidden">
        <Link href="/search" className="lm-msearch">
          <SearchIcon />
          <span>{t("layout.searchPlaceholder")}</span>
        </Link>
        <nav className="lm-chips" aria-label={t("nav.main")}>
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("lm-chip", item.href === SALE_HREF && "sale")}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      </div>

      <section aria-label={t("home.banners.label")}>
        <SectionBoundary fallback={<FallbackBanners />}>
          <Suspense fallback={<BannersSkeleton />}>
            <HomeBanners />
          </Suspense>
        </SectionBoundary>
      </section>

      <SectionBoundary
        fallback={
          <Section title={t("home.newArrivals")}>
            <EmptyState icon={<BagIcon />} title={t("home.emptyNew")} />
          </Section>
        }
      >
        <Suspense
          fallback={
            <Section title={t("home.newArrivals")}>
              <RailSkeleton />
            </Section>
          }
        >
          <NewArrivalsSection currentPath={HOME_PATH} />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary fallback={failed}>
        <Suspense
          fallback={
            <Section title={t("home.byCategory")}>
              <TilesSkeleton />
            </Section>
          }
        >
          <CategoryTilesSection />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary
        fallback={
          <Section title={t("home.onSale")}>
            <EmptyState icon={<BagIcon />} title={t("home.emptySale")} />
          </Section>
        }
      >
        <Suspense
          fallback={
            <Section title={t("home.onSale")}>
              <RailSkeleton />
            </Section>
          }
        >
          <OnSaleSection currentPath={HOME_PATH} />
        </Suspense>
      </SectionBoundary>

      <SectionBoundary fallback={failed}>
        <Suspense
          fallback={
            <Section title={t("home.brands")}>
              <BrandsSkeleton />
            </Section>
          }
        >
          <BrandsSection />
        </Suspense>
      </SectionBoundary>
    </>
  );
}
