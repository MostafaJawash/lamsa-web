import { formatPrice, type DisplayCurrency } from "@/lib/format";

/** A price isolated as LTR inside RTL text (prototype `fmt()` / `.num`). */
export function Amount({ value, currency }: { value: string; currency: DisplayCurrency }) {
  return (
    <span className="lm-num" dir="ltr">
      {formatPrice(value, currency)}
    </span>
  );
}

/**
 * Prototype `priceHTML()`: on sale → the old price struck through, then the current
 * price in accent; otherwise just the price.
 */
export function Price({
  price,
  compareAt,
  currency,
}: {
  price: string;
  compareAt: string | null;
  currency: DisplayCurrency;
}) {
  if (compareAt) {
    return (
      <>
        <s>
          <Amount value={compareAt} currency={currency} />
        </s>
        <b className="lm-now sale">
          <Amount value={price} currency={currency} />
        </b>
      </>
    );
  }
  return (
    <b className="lm-now">
      <Amount value={price} currency={currency} />
    </b>
  );
}
