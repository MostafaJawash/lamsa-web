import { t } from "@/i18n";

import { has, value, values, type ListFilters } from "../filters";
import type { Facets } from "../types";

export type FilterPanelProps = {
  /** The list page (form action). */
  basePath: string;
  filters: ListFilters;
  facets: Facets;
  /** Brand checkboxes (not on a brand page). */
  showBrands: boolean;
  /** "عليه خصم" toggle (not on the sale page). */
  showOnSale: boolean;
  /** Link that removes every filter. */
  clearHref: string;
  /** Called on submit when JavaScript runs (the Sheet); without it the form GETs. */
  formId: string;
};

/**
 * Every facet of `/products/facets` as a GET form with the backend parameter names, so
 * it works without JavaScript (the inline `?filters=1` panel) and inside the client Sheet
 * (which intercepts submit). No hooks: rendered by server and client components.
 */
export function FilterPanel({
  basePath,
  filters,
  facets,
  showBrands,
  showOnSale,
  clearHref,
  formId,
}: FilterPanelProps) {
  const q = value(filters, "q");
  const sort = value(filters, "sort");
  const currency = (value(filters, "price_currency") ?? "SYP") as "SYP" | "USD";
  const price = facets.prices.find((item) => item.currency === currency) ?? facets.prices[0];
  return (
    <form id={formId} method="get" action={basePath} className="lm-fpanel">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      <input type="hidden" name="price_currency" value={currency} />
      <div className="lm-fpanel-body">
        {showBrands && facets.brands.length > 0 ? (
          <fieldset className="lm-fgroup">
            <legend>{t("list.brand")}</legend>
            <div className="lm-fchips">
              {facets.brands.map((brand) => (
                <label key={brand.slug} className="lm-chip">
                  <input
                    type="checkbox"
                    name="brand"
                    value={brand.slug}
                    defaultChecked={has(filters, "brand", brand.slug)}
                  />
                  {brand.name}
                  <small>{brand.count}</small>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="lm-fgroup">
          <legend>{t("list.price")}</legend>
          <div className="lm-frange">
            <label>
              {t("list.minPrice")}
              <input
                className="lm-inp"
                type="number"
                name="min_price"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={price?.min ?? ""}
                defaultValue={value(filters, "min_price") ?? ""}
              />
            </label>
            <label>
              {t("list.maxPrice")}
              <input
                className="lm-inp"
                type="number"
                name="max_price"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={price?.max ?? ""}
                defaultValue={value(filters, "max_price") ?? ""}
              />
            </label>
          </div>
        </fieldset>

        {facets.attributes.map((attr) => {
          const name = `attr.${attr.key}`;
          if (attr.type === "number") {
            return (
              <fieldset key={attr.key} className="lm-fgroup">
                <legend>
                  {attr.label}
                  {attr.unit ? ` (${attr.unit})` : ""}
                </legend>
                <div className="lm-frange">
                  <label>
                    {t("list.min")}
                    <input
                      className="lm-inp"
                      type="number"
                      name={`${name}.min`}
                      inputMode="decimal"
                      placeholder={attr.min == null ? "" : String(attr.min)}
                      defaultValue={value(filters, `${name}.min`) ?? ""}
                    />
                  </label>
                  <label>
                    {t("list.max")}
                    <input
                      className="lm-inp"
                      type="number"
                      name={`${name}.max`}
                      inputMode="decimal"
                      placeholder={attr.max == null ? "" : String(attr.max)}
                      defaultValue={value(filters, `${name}.max`) ?? ""}
                    />
                  </label>
                </div>
              </fieldset>
            );
          }
          if (attr.type === "boolean") {
            return (
              <label key={attr.key} className="lm-toggle lm-fgroup">
                <span>{attr.label}</span>
                <input
                  type="checkbox"
                  name={name}
                  value="true"
                  defaultChecked={has(filters, name, "true")}
                />
                <span className="track" aria-hidden="true" />
              </label>
            );
          }
          const options = attr.values ?? [];
          if (options.length === 0) return null;
          return (
            <fieldset key={attr.key} className="lm-fgroup">
              <legend>{attr.label}</legend>
              <div className="lm-fchips">
                {options.map((option) => (
                  <label key={option.value} className="lm-chip">
                    <input
                      type="checkbox"
                      name={name}
                      value={option.value}
                      defaultChecked={has(filters, name, option.value)}
                    />
                    {option.value}
                    <small>{option.count}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

        {facets.options.map((option) => {
          const name = `opt.${option.key}`;
          if (option.values.length === 0) return null;
          return (
            <fieldset key={option.key} className="lm-fgroup">
              <legend>{option.label}</legend>
              {option.type === "color" ? (
                <div className="lm-swatches">
                  {option.values.map((v) => (
                    <label
                      key={v.value}
                      className="lm-sw"
                      style={{ "--c": v.hex ?? "#ccc" } as React.CSSProperties}
                      title={`${v.value} (${v.count})`}
                    >
                      <input
                        type="checkbox"
                        name={name}
                        value={v.value}
                        defaultChecked={values(filters, name).includes(v.value)}
                        aria-label={`${v.value} (${v.count})`}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="lm-sizes">
                  {option.values.map((v) => (
                    <label key={v.value} className="lm-size">
                      <input
                        type="checkbox"
                        name={name}
                        value={v.value}
                        defaultChecked={values(filters, name).includes(v.value)}
                      />
                      <span dir="ltr">{v.value}</span>
                      <small>{v.count}</small>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}

        {/* No "in stock only" toggle: the backend leaves out-of-stock products out of
            browsing (store setting catalog_hide_out_of_stock). */}
        {showOnSale ? (
          <label className="lm-toggle">
            <span>{t("list.onSale")}</span>
            <input
              type="checkbox"
              name="on_sale"
              value="true"
              defaultChecked={has(filters, "on_sale", "true")}
            />
            <span className="track" aria-hidden="true" />
          </label>
        ) : null}
      </div>
      <div className="lm-fpanel-foot">
        <button type="submit" className="lm-btn primary">
          {t("list.showResults")}
        </button>
        <a href={clearHref} className="lm-btn ghost" data-clear-filters="">
          {t("list.clearAll")}
        </a>
      </div>
    </form>
  );
}
