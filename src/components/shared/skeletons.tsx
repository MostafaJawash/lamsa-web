import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { tileColumns } from "./category-tile";

/**
 * Loading placeholders with the same boxes as the real sections (prototype sizes), so
 * nothing moves when the data arrives.
 */
function Bar({
  width,
  height,
  className,
}: {
  width: string;
  height: number;
  className?: string;
}) {
  return (
    <span className={cn("lm-skel", className)} style={{ width, height }} />
  );
}

export function BannersSkeleton() {
  return (
    <div
      className="lm-banners multi"
      aria-busy="true"
      aria-label={t("common.loading")}
    >
      <div className="lm-banner lm-skel" />
      <div className="lm-banner lm-skel" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="lm-card">
      <div className="lm-card-link">
        <span className="lm-art lm-skel" />
        {/* c-brand (12.5px × 1.6), c-name (15px × 1.4 × 2), c-price (16px × 1.6) */}
        <span style={{ height: 20, display: "flex", alignItems: "center" }}>
          <Bar width="40%" height={10} />
        </span>
        <span
          style={{
            height: 42,
            display: "grid",
            alignContent: "center",
            gap: 8,
          }}
        >
          <Bar width="90%" height={12} />
          <Bar width="60%" height={12} />
        </span>
        <span style={{ height: 26, display: "flex", alignItems: "center" }}>
          <Bar width="45%" height={13} />
        </span>
      </div>
    </div>
  );
}

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="lm-rail" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="lm-cat-tiles"
      style={{ "--cols": tileColumns(count) } as React.CSSProperties}
      aria-busy="true"
      aria-label={t("common.loading")}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="lm-cat-tile">
          <span className="lm-art lm-skel" />
          <span
            style={{
              height: 25.6,
              display: "flex",
              alignItems: "center",
              width: "100%",
            }}
          >
            <Bar width="45%" height={13} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function BrandsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div
      className="lm-brand-row"
      aria-busy="true"
      aria-label={t("common.loading")}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="lm-brand-chip">
          <span className="lm-logo-m lm-skel" style={{ boxShadow: "none" }} />
          <span
            style={{
              height: 20.8,
              display: "flex",
              alignItems: "center",
              width: "100%",
              justifyContent: "center",
            }}
          >
            <Bar width="70%" height={10} />
          </span>
        </div>
      ))}
    </div>
  );
}
