import Link from "next/link";

import { PaletteArt, PerfumeArt } from "@/components/shared/product-art";
import { BackendImage } from "@/components/shared/backend-image";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { linkTarget, ctaKey } from "../links";
import { getBanners } from "../queries";
import type { Banner } from "../types";

/** b-art is 46% of the banner, at most 230px (44% on mobile). */
const BANNER_ART_SIZES = "(max-width: 767px) 40vw, 230px";

/** Alternating prototype backgrounds: .b-sale (#B8174E), .b-new (#2D1B2E). */
function tone(index: number): string {
  return index % 2 === 0 ? "b-sale" : "b-new";
}

function BannerBody({
  art,
  title,
  subtitle,
  cta,
}: {
  art: React.ReactNode;
  title: string;
  subtitle: string | null;
  cta: string | null;
}) {
  return (
    <>
      <span className="b-art">{art}</span>
      <span className="bt">{title}</span>
      {subtitle ? <span className="bs">{subtitle}</span> : null}
      {cta ? <span className="bc">{cta}</span> : null}
    </>
  );
}

function BannerCard({ banner, index }: { banner: Banner; index: number }) {
  const target = linkTarget(banner.link);
  const className = cn("lm-banner", tone(index));
  const body = (
    <BannerBody
      art={
        banner.image ? (
          <BackendImage
            urls={banner.image}
            alt=""
            sizes={BANNER_ART_SIZES}
            priority={index === 0}
          />
        ) : null
      }
      title={banner.title}
      subtitle={banner.subtitle}
      cta={target.kind === "none" ? null : t(ctaKey(banner.link))}
    />
  );
  if (target.kind === "internal") {
    return (
      <Link href={target.href} className={className}>
        {body}
      </Link>
    );
  }
  if (target.kind === "external") {
    return (
      <a
        href={target.href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}

/** The two prototype banners, shown when the backend has none (or is unavailable). */
export function FallbackBanners() {
  return (
    <div className="lm-banners multi">
      <Link href="/sale" className="lm-banner b-sale">
        <BannerBody
          art={<PaletteArt />}
          title={t("home.banners.saleTitle")}
          subtitle={t("home.banners.saleSubtitle")}
          cta={t("home.banners.ctaSale")}
        />
      </Link>
      <Link href="/new" className="lm-banner b-new">
        <BannerBody
          art={<PerfumeArt />}
          title={t("home.banners.newTitle")}
          subtitle={t("home.banners.newSubtitle")}
          cta={t("home.banners.ctaNew")}
        />
      </Link>
    </div>
  );
}

/** Home banners (prototype `.banners`): real ones from GET /banners, else the fallback pair. */
export async function HomeBanners() {
  const result = await getBanners();
  if (result.status !== "ok") return <FallbackBanners />;
  const banners = result.data;
  return (
    <div className={cn("lm-banners", banners.length > 1 && "multi")}>
      {banners.map((banner, index) => (
        <BannerCard key={banner.id} banner={banner} index={index} />
      ))}
    </div>
  );
}
