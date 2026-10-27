"use client";

import type { Route } from "next";
// clsx, not cn(): no tailwind-merge in the client bundle for static class lists.
import { clsx as cn } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { BackendImage } from "@/components/shared/backend-image";
import { Amount } from "@/components/shared/price";
import { ProductSilhouette } from "@/components/shared/product-art";
import { addToCart, addToCartForm } from "@/features/cart/actions";
import { badgeStore } from "@/features/cart/badge-store";
import { cartErrorText } from "@/features/cart/lines";
import { showToast } from "@/features/cart/toast";
import { HeartForm } from "@/features/favorites/components/heart-form";
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

/** What the last add-to-cart said about a variant (null: the product without variants). */
type StockLimit = { variantId: number | null; max: number };

/**
 * The product page's interactive area (prototype `pProduct()` gallery + info): option
 * groups, price, availability, quantity, add-to-cart, heart and tabs. Selecting a variant
 * updates everything at once and writes `?v=<id>` with history.replaceState (no
 * navigation, no refetch). The only client component on the product page.
 *
 * Add to cart is a form (works without JavaScript: the action adds and redirects back
 * with a flash toast); with JavaScript it calls the same action, shows the prototype
 * toast and updates the badges. INSUFFICIENT_STOCK clamps the stepper, OUT_OF_STOCK
 * disables the button. The heart is the shared HeartForm (the layout's controller).
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
  const [limit, setLimit] = useState<StockLimit | null>(null);
  const [adding, startAdding] = useTransition();
  // Unique per page: Next.js keeps visited pages mounted (hidden), ids must not clash.
  const formId = useId();
  const router = useRouter();

  const variant = findVariant(product, variantId);
  const price = priceView(product, variant);
  const stock = stockView(product, variant);
  const images = imagesFor(product, variant);
  const known =
    limit && limit.variantId === (variant?.id ?? null) ? limit : null;
  const max = Math.min(maxQuantity(stock), known ? Math.max(known.max, 1) : 99);
  const quantity = Math.min(qty, max);
  const out = stock.status === "out" || known?.max === 0;
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

  const here = `/p/${product.slug}${variantId ? `?v=${variantId}` : ""}`;

  const onAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adding || out) return;
    const data = new FormData(event.currentTarget);
    data.set("js", "1");
    startAdding(async () => {
      let result;
      try {
        result = await addToCart(data);
      } catch {
        showToast({ text: t("errors.generic") });
        return;
      }
      if (result.ok) {
        badgeStore.set(result.counts);
        showToast(
          {
            text: t("toast.cartAdded"),
            action: { label: t("toast.cartAction"), href: "/cart" },
          },
          (href) => router.push(href),
        );
        return;
      }
      const { error } = result;
      const at = variant?.id ?? null;
      if (error.code === "OUT_OF_STOCK") setLimit({ variantId: at, max: 0 });
      if (error.code === "INSUFFICIENT_STOCK" && error.available !== null) {
        setLimit({ variantId: at, max: error.available });
        setQty(Math.max(1, error.available));
      }
      showToast({ text: cartErrorText(error) });
    });
  };

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
        {out ? <p className="lm-hint">{t("product.outHint")}</p> : null}

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
            type="submit"
            form={formId}
            className="lm-btn primary"
            disabled={out || adding}
            aria-busy={adding}
          >
            {out ? t("product.out") : t("product.addToCart")}
          </button>
          <HeartForm
            productId={product.id}
            slug={product.slug}
            next={here}
            pressed={product.is_favorite}
            className="lm-btn ghost lm-fav-lg"
          />
        </div>
        <form id={formId} action={addToCartForm} onSubmit={onAdd} hidden>
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="slug" value={product.slug} />
          <input type="hidden" name="next" value={here} />
        </form>

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
