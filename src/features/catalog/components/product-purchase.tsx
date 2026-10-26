"use client";

import type { Route } from "next";
// clsx, not cn(): no tailwind-merge in the client bundle for static class lists.
import { clsx as cn } from "clsx";
import Link from "next/link";
import { useRef, useState } from "react";

import { BackendImage } from "@/components/shared/backend-image";
import { HeartIcon } from "@/components/shared/icons";
import { Amount } from "@/components/shared/price";
import { ProductSilhouette } from "@/components/shared/product-art";
import { t } from "@/i18n";
import { formatPrice } from "@/lib/format";

import type { ProductDetail } from "../types";
import {
  findVariant,
  imagesFor,
  maxQuantity,
  pickVariant,
  priceView,
  stockView,
  variantForValue,
} from "../variants";

type ProductPurchaseProps = {
  product: ProductDetail;
  /** Selected on first render (from `?v`, else the default variant). */
  initialVariantId: number | null;
  /** Server-rendered perks list (prototype `.perks`). */
  perks: React.ReactNode;
};

const MAIN_IMAGE_SIZES = "(max-width: 767px) 100vw, 560px";

/**
 * The product page's interactive area (prototype `pProduct()` gallery + info): option
 * groups, price, availability, quantity, add-to-cart, heart and tabs. Selecting a variant
 * updates everything at once and writes `?v=<id>` with history.replaceState (no
 * navigation, no refetch). The only client component on the product page.
 */
export function ProductPurchase({
  product,
  initialVariantId,
  perks,
}: ProductPurchaseProps) {
  const [variantId, setVariantId] = useState(initialVariantId);
  const [view, setView] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "details">("desc");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const variant = findVariant(product, variantId);
  const price = priceView(product, variant);
  const stock = stockView(product, variant);
  const images = imagesFor(product, variant);
  const max = maxQuantity(stock);
  const quantity = Math.min(qty, max);
  const out = stock.status === "out";
  const main = images[Math.min(view, images.length - 1)] ?? null;
  const mainUrls = main?.urls ?? (images.length === 0 ? product.image : null);

  const select = (id: number) => {
    setVariantId(id);
    setView(0);
    setQty(1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(id));
    window.history.replaceState(window.history.state, "", url);
  };

  const tabs = [
    { key: "desc" as const, label: t("product.tabDescription") },
    ...(product.attributes.length > 0
      ? [{ key: "details" as const, label: t("product.tabDetails") }]
      : []),
  ];
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    // RTL: ArrowLeft moves to the next tab, ArrowRight to the previous one.
    const moves: Record<string, number> = {
      ArrowLeft: index + 1,
      ArrowRight: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = (next + tabs.length) % tabs.length;
    setTab(tabs[target]?.key ?? "desc");
    tabRefs.current[target]?.focus();
  };

  const loginHref = `/login?next=${encodeURIComponent(
    `/p/${product.slug}${variantId ? `?v=${variantId}` : ""}`,
  )}`;

  return (
    <div className="lm-prod-grid">
      <div className="lm-gallery">
        <div className="lm-g-main">
          <span className="lm-art">
            <ProductSilhouette />
            {mainUrls ? (
              <BackendImage
                key={main?.id ?? "main"}
                urls={mainUrls}
                alt={main?.alt_text ?? product.name}
                sizes={MAIN_IMAGE_SIZES}
                priority
              />
            ) : null}
          </span>
        </div>
        {images.length >= 2 ? (
          <div className="lm-thumbs" aria-label={t("product.gallery")}>
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                className={cn(index === view && "on")}
                aria-label={t("product.image", { n: index + 1 })}
                aria-pressed={index === view}
                onClick={() => setView(index)}
              >
                <span className="lm-art">
                  <ProductSilhouette />
                  <BackendImage urls={image.urls} alt="" sizes="66px" />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="lm-pinfo">
        {product.brand ? (
          <Link
            href={`/brands/${encodeURIComponent(product.brand.slug)}` as Route}
            className="lm-p-brand"
          >
            {product.brand.name}
          </Link>
        ) : null}
        <h1 className="lm-p-name">{product.name}</h1>
        <div className="lm-p-price">
          {price.regular ? (
            <s>
              <Amount value={price.regular} />
            </s>
          ) : null}
          <b className={cn("lm-now", price.regular && "sale")}>
            <Amount value={price.current} />
          </b>
          {price.savings ? (
            <i className="lm-bd off">
              {t("product.save", { amount: "" })}
              <Amount value={price.savings} />
            </i>
          ) : null}
        </div>

        {product.variant_options.map((option) => {
          const selected = variant?.options[option.key] ?? null;
          return (
            <div key={option.key} className="lm-opt">
              <div className="lm-opt-h">
                {option.label}: <b>{selected ?? ""}</b>
              </div>
              {option.type === "color" ? (
                <div
                  className="lm-swatches"
                  role="radiogroup"
                  aria-label={option.label}
                >
                  {option.values.map((v) => {
                    const target = variantForValue(
                      product,
                      variant,
                      option.key,
                      v.value,
                    );
                    const na = !target || target.stock_status === "out";
                    return (
                      <button
                        key={v.value}
                        type="button"
                        role="radio"
                        aria-checked={selected === v.value}
                        className={cn(
                          "lm-sw",
                          selected === v.value && "on",
                          na && "na",
                        )}
                        style={
                          { "--c": v.hex ?? "#ccc" } as React.CSSProperties
                        }
                        aria-label={
                          na ? `${v.value} ${t("product.outShort")}` : v.value
                        }
                        title={v.value}
                        onClick={() => {
                          const picked = pickVariant(
                            product,
                            variant,
                            option.key,
                            v.value,
                          );
                          if (picked) select(picked.id);
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div
                  className="lm-sizes"
                  role="radiogroup"
                  aria-label={option.label}
                >
                  {option.values.map((v) => {
                    const target = variantForValue(
                      product,
                      variant,
                      option.key,
                      v.value,
                    );
                    const na = !target || target.stock_status === "out";
                    return (
                      <button
                        key={v.value}
                        type="button"
                        role="radio"
                        aria-checked={selected === v.value}
                        className={cn(
                          "lm-size",
                          selected === v.value && "on",
                          na && "na",
                        )}
                        onClick={() => {
                          const picked = pickVariant(
                            product,
                            variant,
                            option.key,
                            v.value,
                          );
                          if (picked) select(picked.id);
                        }}
                      >
                        <span dir="ltr">{v.value}</span>
                        {target ? (
                          <small>
                            <span className="lm-num" dir="ltr">
                              {formatPrice(target.current_price)}
                            </span>
                          </small>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div
          className={cn(
            "lm-avail",
            stock.status === "out"
              ? "no"
              : stock.status === "low"
                ? "low"
                : "ok",
          )}
          role="status"
        >
          {stock.status === "out"
            ? t("product.out")
            : stock.status === "low" && stock.left
              ? t("product.low", { n: stock.left })
              : t("product.inStock")}
        </div>

        <div className="lm-buy">
          <div
            className="lm-qty"
            role="group"
            aria-label={t("product.quantity")}
          >
            <button
              type="button"
              aria-label={t("product.less")}
              disabled={out || quantity <= 1}
              onClick={() => setQty(Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span aria-live="polite">{quantity}</span>
            <button
              type="button"
              aria-label={t("product.more")}
              disabled={out || quantity >= max}
              onClick={() => setQty(Math.min(max, quantity + 1))}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="lm-btn primary"
            disabled={out}
            onClick={() => {
              // TODO(cart phase): add to the cart (server action) and remove this toast.
              // sonner is loaded on the first click (the Toaster itself is deferred too).
              void import("sonner").then(({ toast }) =>
                toast(t("product.cartSoon")),
              );
            }}
          >
            {out ? t("product.out") : t("product.addToCart")}
          </button>
          <a
            href={loginHref}
            className="lm-btn ghost lm-fav-lg"
            aria-label={t("product.favorite")}
          >
            <HeartIcon />
          </a>
        </div>

        <div className="lm-ptabs">
          <div className="lm-tabs" role="tablist">
            {tabs.map((item, index) => (
              <button
                key={item.key}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`lm-tab-${item.key}`}
                aria-selected={tab === item.key}
                aria-controls={`lm-panel-${item.key}`}
                tabIndex={tab === item.key ? 0 : -1}
                onClick={() => setTab(item.key)}
                onKeyDown={(e) => onTabKey(e, index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="lm-panel-desc"
            aria-labelledby="lm-tab-desc"
            hidden={tab !== "desc"}
          >
            <p>{product.description || t("product.noDescription")}</p>
          </div>
          {product.attributes.length > 0 ? (
            <div
              role="tabpanel"
              id="lm-panel-details"
              aria-labelledby="lm-tab-details"
              hidden={tab !== "details"}
            >
              <dl>
                {product.attributes.map((attr) => (
                  <div key={attr.key}>
                    <dt>{attr.label}</dt>
                    <dd>{attr.display}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
        {perks}
      </div>
    </div>
  );
}
