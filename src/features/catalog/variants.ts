import type {
  ProductDetail,
  ProductImage,
  StockStatus,
  Variant,
} from "./types";

/** Default selection: the first in-stock variant (prototype `firstAvail`), else the first. */
export function defaultVariantId(product: ProductDetail): number | null {
  if (product.variants.length === 0) return null;
  const inStock = product.variants.find((v) => v.stock_status !== "out");
  return (inStock ?? product.variants[0])?.id ?? null;
}

/** The variant for a `?v=` value, if it belongs to the product. */
export function variantFromParam(
  product: ProductDetail,
  raw: string | string[] | undefined,
): number | null {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text || !/^\d{1,10}$/.test(text)) return null;
  const id = Number(text);
  return product.variants.some((v) => v.id === id) ? id : null;
}

export function findVariant(
  product: ProductDetail,
  id: number | null,
): Variant | null {
  return product.variants.find((v) => v.id === id) ?? null;
}

/** "وردي ترابي" or "50 ml" (values in the order of the product's options). */
export function variantLabel(product: ProductDetail, variant: Variant): string {
  return product.variant_options
    .map((option) => variant.options[option.key])
    .filter((v): v is string => !!v)
    .join(" / ");
}

/**
 * The variant to select when the visitor picks `value` for option `key`: the one that
 * keeps the other current choices, else any variant with that value (in stock first).
 */
export function pickVariant(
  product: ProductDetail,
  current: Variant | null,
  key: string,
  value: string,
): Variant | null {
  const candidates = product.variants.filter((v) => v.options[key] === value);
  if (candidates.length === 0) return current;
  const keepsOthers = (v: Variant) =>
    product.variant_options.every(
      (o) =>
        o.key === key ||
        !current ||
        v.options[o.key] === current.options[o.key],
    );
  return (
    candidates.find((v) => keepsOthers(v)) ??
    candidates.find((v) => v.stock_status !== "out") ??
    candidates[0] ??
    current
  );
}

/** The variant a value leads to (for its price and availability), see `pickVariant`. */
export function variantForValue(
  product: ProductDetail,
  current: Variant | null,
  key: string,
  value: string,
): Variant | null {
  const picked = pickVariant(product, current, key, value);
  return picked && picked.options[key] === value ? picked : null;
}

export type PriceView = {
  current: string;
  /** The struck price when on sale, else null. */
  regular: string | null;
  /** regular − current ("وفّر"), else null. */
  savings: string | null;
};

function cents(amount: string): number {
  const [whole = "0", fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

function fromCents(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

/** Prices of the selected variant, or of a simple product / bundle. */
export function priceView(
  product: ProductDetail,
  variant: Variant | null,
): PriceView {
  let current: string;
  let regular: string | null;
  if (variant) {
    current = variant.current_price;
    regular = variant.sale_price != null ? variant.price : null;
  } else {
    current = product.current_price ?? product.price;
    regular =
      product.sale_price != null
        ? (product.regular_price ?? product.compare_at_price ?? null)
        : null;
  }
  const savings =
    regular && cents(regular) > cents(current)
      ? fromCents(cents(regular) - cents(current))
      : null;
  return { current, regular: savings ? regular : null, savings };
}

export type StockView = { status: StockStatus; left: number | null };

export function stockView(
  product: ProductDetail,
  variant: Variant | null,
): StockView {
  if (variant)
    return { status: variant.stock_status, left: variant.stock_left };
  return {
    status: product.stock_status ?? (product.in_stock ? "in_stock" : "out"),
    left: product.stock_left ?? null,
  };
}

/** Largest quantity for the stepper: 1..10, bounded by the stock left. */
export function maxQuantity(stock: StockView): number {
  if (stock.status === "out") return 1;
  return Math.max(1, Math.min(10, stock.left ?? 10));
}

/**
 * Images to show: the variant's `image_ids` in that order; otherwise the general images
 * (not tied to a variant), or every image when there are no general ones.
 */
export function imagesFor(
  product: ProductDetail,
  variant: Variant | null,
): ProductImage[] {
  if (variant && variant.image_ids.length > 0) {
    const byId = new Map(product.images.map((image) => [image.id, image]));
    const ordered = variant.image_ids
      .map((id) => byId.get(id))
      .filter((image): image is ProductImage => !!image);
    if (ordered.length > 0) return ordered;
  }
  const general = product.images.filter((image) => image.variant_id === null);
  return general.length > 0 ? general : product.images;
}
