import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/catalog/queries", () => ({}));

const { Pager } = await import("@/features/catalog/components/list-results");
const { parseFilters } = await import("@/features/catalog/filters");

const CARE = { kind: "category", slug: "care" } as const;

describe("Pager", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pager basePath="/c/care" filters={[]} scope={CARE} total={24} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("links pages with the filters kept, prev/next and the current page", () => {
    const filters = parseFilters(new URLSearchParams("brand=a&page=3"), CARE);
    render(
      <Pager
        basePath="/c/care"
        filters={filters}
        scope={CARE}
        total={24 * 6}
      />,
    );
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "التالي" })).toHaveAttribute(
      "href",
      "/c/care/page/4?brand=a#lm-results",
    );
    expect(screen.getByRole("link", { name: "السابق" })).toHaveAttribute(
      "href",
      "/c/care/page/2?brand=a#lm-results",
    );
    // Page 1 is the list path itself; the last page is always listed.
    expect(screen.getByRole("link", { name: "صفحة 1" })).toHaveAttribute(
      "href",
      "/c/care?brand=a#lm-results",
    );
    expect(screen.getByRole("link", { name: "صفحة 6" })).toBeInTheDocument();
  });

  it("disables prev on the first page and next on the last", () => {
    render(
      <Pager basePath="/new" filters={[]} scope={{ kind: "new" }} total={50} />,
    );
    expect(screen.getByRole("link", { name: "السابق" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "التالي" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });
});
