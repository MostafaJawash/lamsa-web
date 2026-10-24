import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Price } from "@/components/shared/price";

describe("Price", () => {
  it("shows only the price when not on sale", () => {
    const { container } = render(<Price price="8.95" compareAt={null} />);
    expect(container.querySelector("s")).toBeNull();
    const now = container.querySelector("b.lm-now");
    expect(now).toHaveTextContent("8,95 €");
    expect(now).not.toHaveClass("sale");
  });

  it("strikes the old price and highlights the sale price", () => {
    const { container } = render(<Price price="11.95" compareAt="15.95" />);
    expect(container.querySelector("s")).toHaveTextContent("15,95 €");
    const now = container.querySelector("b.lm-now.sale");
    expect(now).toHaveTextContent("11,95 €");
    expect(container.firstElementChild?.tagName).toBe("S");
  });

  it("isolates amounts as LTR inside RTL text", () => {
    const { container } = render(<Price price="1234.50" compareAt={null} />);
    const amount = container.querySelector(".lm-num");
    expect(amount).toHaveAttribute("dir", "ltr");
    expect(amount).toHaveTextContent("1.234,50 €");
  });
});
