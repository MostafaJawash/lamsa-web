import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentTheme,
  setTheme,
  THEME_COLORS,
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
} from "@/lib/theme";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");

function clearCookie() {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
}

function runInitScript() {
  // The same source the root layout inlines in <head>.
  new Function(THEME_INIT_SCRIPT)();
}

beforeEach(() => {
  clearCookie();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = `<meta name="theme-color" content="${THEME_COLORS.light}">`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("default theme", () => {
  it("is light for a new visitor even when the device prefers dark", () => {
    // A device in dark mode: every prefers-color-scheme query says "dark".
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("dark"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    runInitScript();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(currentTheme()).toBe("light");
  });

  it("no longer follows prefers-color-scheme in the stylesheet or the viewport", () => {
    expect(css).not.toContain("prefers-color-scheme");
    const layout = readFileSync(resolve(root, "src/app/layout.tsx"), "utf8");
    expect(layout).not.toContain("prefers-color-scheme");
    expect(layout).toContain('colorScheme: "light"');
  });

  it("applies the dark tokens only under data-theme=dark, with unchanged values", () => {
    const dark = /:root\[data-theme="dark"\] \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(dark).toContain("--lamsa-bg: #161015;");
    expect(dark).toContain("--lamsa-surface-2: #2c2029;");
    expect(dark).toContain("color-scheme: dark;");
    const light = /^:root \{([^}]*)\}/m.exec(css)?.[1] ?? "";
    expect(light).toContain("--lamsa-bg: #f7f0f2;");
    expect(light).toContain("--lamsa-surface-2: #f1e5ea;");
  });
});

describe("manual toggle", () => {
  it("setTheme('dark') applies, remembers and updates the browser chrome color", () => {
    setTheme("dark");
    expect(currentTheme()).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe(THEME_COLORS.dark);
  });

  it("a returning visitor with the dark cookie gets dark before paint", () => {
    setTheme("dark");
    document.documentElement.removeAttribute("data-theme");
    runInitScript();
    expect(currentTheme()).toBe("dark");
  });

  it("switching back to light removes the attribute", () => {
    setTheme("dark");
    setTheme("light");
    expect(currentTheme()).toBe("light");
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    runInitScript();
    expect(currentTheme()).toBe("light");
  });
});
