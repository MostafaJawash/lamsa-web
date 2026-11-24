import Link from "next/link";
import { Suspense } from "react";

import { PageChrome } from "@/components/layout/page-chrome";
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

const HOME_PATH = "/";

/**
 * Home (prototype `pHome()`). Every section loads on its own: a Suspense skeleton of the
 * same size while loading, its own error boundary, and an empty/fallback state from the
 * query result, so the page always renders.
 */
export default function HomePage() {
  const failed = <p className="sr-only">{t("home.sectionFailed")}</p>;
  return (
    <PageChrome path="/">
      <h1 className="sr-only">{t("home.title")}</h1>

      {/* Mobile only: fake search field. The section chips live on the list pages; Home
          reaches them through the category tiles, the "عرض الكل" links and the Categories tab. */}
      <div className="md:hidden">
        <Link href="/search" className="lm-msearch">
          <SearchIcon />
          <span>{t("layout.searchPlaceholder")}</span>
        </Link>
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
    </PageChrome>
  );
}
