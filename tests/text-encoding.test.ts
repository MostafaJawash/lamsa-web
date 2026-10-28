import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const textSuffixes = new Set([
  ".py",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".sql",
  ".html",
  ".css",
]);
const mojibakeMarkers = ["\u00c2", "\u00c3", "\u00d8", "\u00d9", "\u00e2", "\u00f0", "\ufffd"];

describe("tracked text encoding", () => {
  it("is valid UTF-8 without common mojibake markers", () => {
    const root = resolve(import.meta.dirname, "..");
    const tracked = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
    })
      .toString("utf8")
      .split("\0")
      .filter((path) => path && textSuffixes.has(extname(path).toLowerCase()));
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const failures: string[] = [];

    for (const relative of tracked) {
      let text: string;
      try {
        text = decoder.decode(readFileSync(resolve(root, relative)));
      } catch {
        failures.push(`${relative}: invalid UTF-8`);
        continue;
      }
      text.split(/\r?\n/u).forEach((line, index) => {
        const markers = mojibakeMarkers
          .filter((marker) => line.includes(marker))
          .map((marker) => `U+${marker.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`);
        if (markers.length > 0) {
          failures.push(`${relative}:${index + 1}: mojibake marker(s) ${markers.join(", ")}`);
        }
      });
    }

    expect(failures).toEqual([]);
  });
});
