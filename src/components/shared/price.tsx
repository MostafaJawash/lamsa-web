import { formatPrice } from "@/lib/format";

/** A price isolated as LTR inside RTL text (prototype `fmt()` / `.num`). */
export function Amount({ value }: { value: string }) {
  return (
    <span className="lm-num" dir="ltr">
      {formatPrice(value)}
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
}: {
  price: string;
  compareAt: string | null;
}) {
  if (compareAt) {
    return (
      <>
        <s>
          <Amount value={compareAt} />
        </s>
        <b className="lm-now sale">
          <Amount value={price} />
        </b>
      </>
    );
  }
  return (
    <b className="lm-now">
      <Amount value={price} />
    </b>
  );
}
