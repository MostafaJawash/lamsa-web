import { describe, expect, it } from "vitest";

import {
  BRAND_COLORS,
  brandColor,
  monogram,
} from "@/features/catalog/brand-mark";

describe("monogram", () => {
  it("takes the first letter without tashkeel, like the prototype norm()", () => {
    expect(monogram("لُمى")).toBe("ل");
    expect(monogram("وَرد")).toBe("و");
    expect(monogram("مِسك")).toBe("م");
    expect(monogram("  بيتي")).toBe("ب");
  });

  it("works for Latin names and empty input", () => {
    expect(monogram("Luma")).toBe("L");
    expect(monogram("")).toBe("");
  });
});

describe("brandColor", () => {
  it("is deterministic and always a prototype brand color", () => {
    for (let id = 0; id < 200; id++) {
      const color = brandColor(id);
      expect(BRAND_COLORS).toContain(color);
      expect(brandColor(id)).toBe(color);
    }
  });

  it("spreads ids over the palette", () => {
    const used = new Set(
      Array.from({ length: 50 }, (_, id) => brandColor(id + 1)),
    );
    expect(used.size).toBeGreaterThanOrEqual(5);
  });
});
