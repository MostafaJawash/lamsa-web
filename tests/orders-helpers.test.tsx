import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Amounts } from "@/components/shared/price";
import {
  describeAddressSnapshot,
  openStreetMapUrl,
} from "@/features/orders/address-snapshot";
import {
  orderFilters,
  parseOrderFilter,
  parsePage,
  statusGroupFor,
  statusTone,
} from "@/features/orders/status";
import { addressRoute } from "@/features/account/routes";
import { orderRoute } from "@/features/orders/routes";
import { formatAmount } from "@/lib/format";

describe("order status filter", () => {
  it("maps each chip to the backend's status_group (none for all)", () => {
    expect(orderFilters).toEqual(["all", "active", "completed", "cancelled"]);
    expect(statusGroupFor("all")).toBeUndefined();
    expect(statusGroupFor("active")).toBe("active");
    expect(statusGroupFor("completed")).toBe("completed");
    expect(statusGroupFor("cancelled")).toBe("cancelled");
  });

  it("reads the page URL safely", () => {
    expect(parseOrderFilter("completed")).toBe("completed");
    expect(parseOrderFilter(["cancelled", "active"])).toBe("cancelled");
    expect(parseOrderFilter("shipped")).toBe("all"); // a status, not a group
    expect(parseOrderFilter(undefined)).toBe("all");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("tones the status pill by the backend status", () => {
    expect(statusTone("pending")).toBe("s0");
    expect(statusTone("preparing")).toBe("s1");
    expect(statusTone("shipped")).toBe("s2");
    expect(statusTone("ready_for_pickup")).toBe("s2");
    expect(statusTone("delivered")).toBe("s3");
    expect(statusTone("cancelled")).toBe("sx");
  });
});

describe("order address snapshot (old and new formats)", () => {
  const name = (code: string) => (code === "damascus" ? "دمشق" : code);

  it("reads the Syrian snapshot, with a map location", () => {
    const view = describeAddressSnapshot(
      {
        label: "البيت",
        governorate: "damascus",
        area: "المزة",
        details: "شارع الجلاء، بناء 12",
        latitude: "33.513800",
        longitude: "36.276500",
        notes: "الطابق الثالث",
      },
      name,
    );
    expect(view).toEqual({
      lines: ["البيت", "دمشق، المزة", "شارع الجلاء، بناء 12"],
      notes: "الطابق الثالث",
      location: { lat: "33.513800", lng: "36.276500" },
    });
  });

  it("has no location without both coordinates", () => {
    const view = describeAddressSnapshot(
      {
        governorate: "damascus",
        details: "تفاصيل العنوان",
        latitude: "33.5",
        longitude: null,
      },
      name,
    );
    expect(view?.location).toBeNull();
  });

  it("reads the old city / street / building snapshot", () => {
    const view = describeAddressSnapshot(
      { city: "برلين", street: "شارع الورد", building: "12", notes: "الجرس" },
      name,
    );
    expect(view).toEqual({
      lines: ["برلين", "شارع الورد", "12"],
      notes: "الجرس",
      location: null,
    });
  });

  it("has no address for an old pickup order or an empty snapshot", () => {
    expect(describeAddressSnapshot(null, name)).toBeNull();
    expect(describeAddressSnapshot(undefined, name)).toBeNull();
    expect(describeAddressSnapshot({}, name)).toBeNull();
  });

  it("links OpenStreetMap, not another provider", () => {
    const url = openStreetMapUrl({ lat: "33.513800", lng: "36.276500" });
    expect(url).toBe(
      "https://www.openstreetmap.org/?mlat=33.513800&mlon=36.276500#map=16/33.513800/36.276500",
    );
  });
});

describe("currency display in totals", () => {
  it("formats SYP, USD and a legacy EUR snapshot", () => {
    expect(formatAmount("94000.00", "SYP")).toBe("94,000 ل.س");
    expect(formatAmount("39.90", "USD")).toBe("39.9 $");
    expect(formatAmount("8.95", "EUR")).toBe("8.95 €");
    expect(formatAmount("5.00", "XYZ")).toBe("5.00 XYZ");
  });

  it("shows one amount per currency and never adds them", () => {
    const { container } = render(
      <Amounts
        items={[
          { currency: "SYP", amount: "94000.00" },
          { currency: "USD", amount: "39.90" },
        ]}
      />,
    );
    const amounts = [...container.querySelectorAll(".lm-num")].map(
      (node) => node.textContent,
    );
    expect(amounts).toEqual(["94,000 ل.س", "39.9 $"]);
    expect(container.textContent).not.toMatch(/133/);
    expect(container.querySelector(".lm-amounts")).not.toHaveClass("inline");
  });

  it("can lay the amounts out in one row", () => {
    const { container } = render(
      <Amounts inline items={[{ currency: "USD", amount: "19.95" }]} />,
    );
    expect(container.querySelector(".lm-amounts")).toHaveClass("inline");
  });
});

describe("order routes (the proxy's 404 check)", () => {
  it("recognises an order's own pages and their id", () => {
    expect(orderRoute("/account/orders/1004")).toEqual({
      action: "check",
      id: 1004,
    });
    expect(orderRoute("/checkout/success/7")).toEqual({
      action: "check",
      id: 7,
    });
    expect(orderRoute("/account/orders/7/")).toEqual({
      action: "check",
      id: 7,
    });
  });

  it("answers not-found for anything that cannot be an order id", () => {
    for (const path of [
      "/account/orders/abc",
      "/account/orders/0",
      "/account/orders/-3",
      "/account/orders/1.5",
      "/checkout/success/99999999999",
    ])
      expect(orderRoute(path), path).toEqual({ action: "not-found" });
  });

  it("ignores every other path", () => {
    for (const path of [
      "/account/orders",
      "/checkout",
      "/account/orders/1/x",
      "/p/shampoo",
      "/",
    ])
      expect(orderRoute(path), path).toBeNull();
  });
});

describe("address routes (the proxy's 404 check)", () => {
  const route = (path: string, query: string) =>
    addressRoute(path, new URLSearchParams(query));

  it("names the address of ?edit= and ?delete=", () => {
    expect(route("/account/addresses", "edit=12")).toEqual({
      action: "check",
      id: 12,
    });
    expect(route("/account/addresses", "delete=3")).toEqual({
      action: "check",
      id: 3,
    });
    expect(route("/account/addresses/", "edit=5&new=1")).toEqual({
      action: "check",
      id: 5,
    });
  });

  it("answers not-found for an id that cannot be an address", () => {
    expect(route("/account/addresses", "edit=abc")).toEqual({
      action: "not-found",
    });
    expect(route("/account/addresses", "delete=0")).toEqual({
      action: "not-found",
    });
  });

  it("ignores the plain list, the new-address form and other pages", () => {
    expect(route("/account/addresses", "")).toBeNull();
    expect(route("/account/addresses", "new=1")).toBeNull();
    expect(route("/account/orders", "edit=1")).toBeNull();
  });
});
