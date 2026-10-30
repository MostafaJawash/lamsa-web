import { describe, expect, it } from "vitest";

import {
  DEFAULT_CENTER,
  governorateCenter,
  governorateCenters,
  governorateCodes,
  isGovernorateCode,
  isWithinSyria,
  formatCoordinate,
  SYRIA_BOUNDS,
} from "@/config/governorates";

describe("governorates config", () => {
  it("covers the 14 governorates, each with a centre inside Syria", () => {
    expect(governorateCodes).toHaveLength(14);
    expect(new Set(governorateCodes).size).toBe(14);
    for (const code of governorateCodes) {
      const { lat, lng } = governorateCenters[code];
      expect(isWithinSyria(lat, lng), code).toBe(true);
    }
  });

  it("opens the map on Damascus when there is no (known) governorate", () => {
    expect(DEFAULT_CENTER).toEqual(governorateCenters.damascus);
    expect(governorateCenter(undefined)).toEqual(DEFAULT_CENTER);
    expect(governorateCenter("")).toEqual(DEFAULT_CENTER);
    expect(governorateCenter("atlantis")).toEqual(DEFAULT_CENTER);
    expect(governorateCenter("aleppo")).toEqual(governorateCenters.aleppo);
    expect(governorateCenter("aleppo")).not.toEqual(DEFAULT_CENTER);
  });

  it("recognises governorate codes", () => {
    expect(isGovernorateCode("rif_dimashq")).toBe(true);
    expect(isGovernorateCode("berlin")).toBe(false);
  });
});

describe("isWithinSyria (the backend's bounding box)", () => {
  it("accepts the box including its edges", () => {
    expect(isWithinSyria(33.5138, 36.2765)).toBe(true);
    expect(isWithinSyria(SYRIA_BOUNDS.south, SYRIA_BOUNDS.west)).toBe(true);
    expect(isWithinSyria(SYRIA_BOUNDS.north, SYRIA_BOUNDS.east)).toBe(true);
  });

  it("rejects points outside it", () => {
    expect(isWithinSyria(52.52, 13.405)).toBe(false); // Berlin
    expect(isWithinSyria(31.95, 35.93)).toBe(false); // Amman, south of the box
    expect(isWithinSyria(33.5, 43)).toBe(false);
    expect(isWithinSyria(37.41, 36)).toBe(false);
    expect(isWithinSyria(33, 35.59)).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(isWithinSyria(Number.NaN, 36)).toBe(false);
    expect(isWithinSyria(33, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("formats coordinates with at most the 6 decimals the backend accepts", () => {
    expect(formatCoordinate(33.51380012345)).toBe("33.513800");
    expect(formatCoordinate(36)).toBe("36.000000");
  });
});
