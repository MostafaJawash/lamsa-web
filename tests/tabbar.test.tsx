import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/count-badge", () => ({ CountBadge: () => null }));

import { Tabbar } from "@/components/layout/tabbar";

const css = readFileSync(
  resolve(import.meta.dirname, "../src/app/globals.css"),
  "utf8",
);

/** The declarations of the first rule with exactly this selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.[\]()]/g, "\\$&");
  return new RegExp(`${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
}

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--lamsa-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

const counts = { cart: 0, favorites: 0, notifications: 0 };

describe("mobile tabbar colors", () => {
  const light = tokens(/^:root \{([^}]*)\}/m.exec(css)?.[1] ?? "");
  const dark = tokens(
    /:root\[data-theme="dark"\] \{([^}]*)\}/.exec(css)?.[1] ?? "",
  );

  it("uses --lamsa-surface-2, not the page's --lamsa-bg", () => {
    expect(rule(".lm-tabbar")).toMatch(
      /background:\s*var\(--lamsa-surface-2\)/,
    );
    // The page background: shadcn's --background = --lamsa-bg (body is bg-background).
    expect(css).toMatch(/--background:\s*var\(--lamsa-bg\)/);
  });

  it("differs from the page background in light and in dark", () => {
    expect(light["--lamsa-surface-2"]).toBeDefined();
    expect(light["--lamsa-surface-2"]).not.toBe(light["--lamsa-bg"]);
    expect(dark["--lamsa-surface-2"]).toBeDefined();
    expect(dark["--lamsa-surface-2"]).not.toBe(dark["--lamsa-bg"]);
  });
});

describe("tab-switch animation", () => {
  beforeEach(() => {
    pathname.value = "/";
  });

  it("defines a 260ms easeOutBack pop for the active icon, armed only after a navigation", () => {
    const popRule = rule(".lm-tabbar[data-pop] a.on .lm-ic");
    expect(popRule).toContain("lm-tab-pop 260ms");
    expect(popRule).toContain("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });

  it("is switched off by prefers-reduced-motion", () => {
    const reduced =
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(
        css,
      )?.[1];
    expect(reduced).toMatch(/animation:\s*none !important/);
  });

  it("does not arm the pop on the first render, and arms it when the tab changes", () => {
    const { container, rerender } = render(
      <Tabbar accountHref="/login" counts={counts} />,
    );
    const nav = container.querySelector("nav.lm-tabbar") as HTMLElement;
    expect(nav).not.toHaveAttribute("data-pop");
    expect(nav.querySelector("a.on")).toHaveAttribute("href", "/");

    pathname.value = "/cart";
    rerender(<Tabbar accountHref="/login" counts={counts} />);
    expect(nav).toHaveAttribute("data-pop");
    expect(nav.querySelector("a.on")).toHaveAttribute("href", "/cart");
  });
});
