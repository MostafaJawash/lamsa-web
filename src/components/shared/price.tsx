import { formatAmount, type DisplayCurrency } from "@/lib/format";

/**
 * A price isolated as LTR inside RTL text (prototype `fmt()` / `.num`). `currency` is
 * usually SYP or USD; a legacy order may carry another code (see `formatAmount`).
 */
export function Amount({
  value,
  currency,
}: {
  value: string;
  currency: DisplayCurrency | (string & {});
}) {
  return (
    <span className="lm-num" dir="ltr">
      {formatAmount(value, currency)}
    </span>
  );
}

/**
 * Per-currency amounts (subtotals, savings, totals), one line per currency and never
 * added together: a cart or order in both Syrian pounds and dollars shows both.
 */
export function Amounts({
  items,
  inline = false,
}: {
  items: readonly { currency: string; amount: string }[];
  /** One row, amounts separated by a dot (order lists), instead of one line each. */
  inline?: boolean;
}) {
  return (
    <span className={inline ? "lm-amounts inline" : "lm-amounts"}>
      {items.map((item) => (
        <Amount
          key={item.currency}
          value={item.amount}
          currency={item.currency}
        />
      ))}
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
