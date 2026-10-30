import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("vendored Leaflet stylesheet", () => {
  it("is the installed package's leaflet.css (only the header comment is added)", () => {
    const root = resolve(import.meta.dirname, "..");
    const vendored = readFileSync(
      resolve(root, "public/vendor/leaflet/leaflet.css"),
      "utf8",
    );
    const original = readFileSync(
      resolve(root, "node_modules/leaflet/dist/leaflet.css"),
      "utf8",
    );
    expect(vendored.endsWith(original)).toBe(true);
    const header = vendored.slice(0, vendored.length - original.length);
    expect(header).toContain("Leaflet 1.9.4");
    const version = JSON.parse(
      readFileSync(resolve(root, "node_modules/leaflet/package.json"), "utf8"),
    ) as { version: string };
    expect(version.version).toBe("1.9.4");
  });
});
