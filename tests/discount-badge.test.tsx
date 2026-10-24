import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscountBadge } from "@/components/shared/product-card";

describe("DiscountBadge", () => {
  it("reads minus sign, number, Arabic percent sign, in that logical order", () => {
    const { container } = render(<DiscountBadge percent={25} />);
    const badge = container.querySelector(".lm-bd.off");
    // U+2212 MINUS SIGN, "25", U+066A ARABIC PERCENT SIGN.
    expect(badge?.textContent).toBe("−25٪");
  });

  it("is an isolated LTR run, so RTL text cannot reorder it to '25٪−'", () => {
    const { container } = render(<DiscountBadge percent={30} />);
    const badge = container.querySelector(".lm-bd.off");
    expect(badge).toHaveAttribute("dir", "ltr");
    expect(badge).toHaveClass("lm-num"); // unicode-bidi: isolate
  });
});
