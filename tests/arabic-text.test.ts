import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const MARKERS = [
  "رح",
  "هلق",
  "هلأ",
  "هلّق",
  "بدك",
  "بدي",
  "شو",
  "هيك",
  "منيح",
  "كتير",
  "ما في",
  "مش",
  "ليش",
  "وين",
  "هون",
  "هاد",
  "هدول",
  "هيدا",
  "لسا",
  "لسّا",
  "عم",
  "تبع",
  "شوي",
  "مشان",
  "منشان",
  "إلك",
  "إلو",
  "هلقد",
  "كمان",
  "بس",
  "ناطر",
  "ناطرة",
  "فاضي",
  "فاضية",
  "بوكس",
  "فيك",
  "اللي",
  "تانية",
  "خلص",
  "هالإشعار",
  "مطفي",
] as const;

// "مطفي" is the established cosmetics option value and must not be migrated.
const ALLOWLIST = new Set<string>(["مطفي"]);
const candidates = MARKERS.filter((marker) => !ALLOWLIST.has(marker));
const pattern = new RegExp(
  `(?<![ء-غف-يً-ٰٟ])(${candidates.map(escapeRegExp).join("|")})(?![ء-غف-يً-ٰٟ])`,
  "u",
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".css", ".svg"].includes(extname(path))
      ? [path]
      : [];
  });
}

describe("Arabic copy", () => {
  it("contains no Levantine markers in the catalog or source", () => {
    const files = [
      join(ROOT, "messages", "ar.json"),
      ...sourceFiles(join(ROOT, "src")),
    ];
    const failures: string[] = [];
    for (const file of files) {
      for (const [index, line] of readFileSync(file, "utf8")
        .split("\n")
        .entries()) {
        const match = pattern.exec(line);
        if (match)
          failures.push(`${relative(ROOT, file)}:${index + 1}: ${match[0]}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
