import { BrandLogo } from "@/components/shared/brand-logo";
import { t } from "@/i18n";
import { pluralize } from "@/lib/format";

import type { Brand } from "../types";

/** Prototype `.brand-hero`: large logo (or monogram), name, own-brand badge, count. */
export function BrandHero({ brand }: { brand: Brand }) {
  return (
    <div className="lm-brand-hero">
      <BrandLogo id={brand.id} name={brand.name} logo={brand.logo} large />
      <div>
        <div className="lm-list-head">
          <h1>{brand.name}</h1>
          {brand.is_own_brand ? (
            <i className="lm-bd own">{t("brands.own")}</i>
          ) : null}
        </div>
        <span className="lm-count">
          {pluralize(brand.product_count, "products")}
        </span>
      </div>
    </div>
  );
}
