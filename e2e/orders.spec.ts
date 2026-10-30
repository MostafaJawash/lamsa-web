import type { Page } from "@playwright/test";

import { call } from "./support/backend";
import { expect, test } from "./support/fixtures";
import {
  ALEPPO,
  COURIER,
  DAMASCUS,
  PROVINCE,
  SYP_PRODUCT,
  USD_PRODUCT,
  adminStatus,
  addAddress,
  addToCart,
  customer,
  ensureStock,
  expectedTotals,
  makeOrder,
  orderOf,
  placeOrderViaApi,
  signIn,
} from "./support/checkout";
import { price } from "./support/shop";

/**
 * Orders: the list (pagination, status filter), the order page (timeline, items, delivery,
 * address, payment, totals), cancelling, reordering, and privacy. Orders are made through
 * the API and moved along with the backend's admin API; the pages are driven through the UI.
 */

test.beforeAll(async () => {
  await ensureStock(SYP_PRODUCT, 80);
  await ensureStock(USD_PRODUCT, 40);
});

const rows = (page: Page) => page.locator(".lm-order-row:visible");
const chip = (page: Page, filter: string) =>
  page.locator(`.lm-chips:visible a[data-filter="${filter}"]`);

async function cancelViaApi(token: string, id: number) {
  await call("POST", `/orders/${id}/cancel`, { token, body: {} });
}

test.describe("orders list", () => {
  test("pagination and the status filters", async ({ page, accounts }) => {
    test.setTimeout(180_000);
    const who = await customer(accounts, "orders");
    const address = await addAddress(who.token, ALEPPO);
    const ids: number[] = [];
    for (let i = 0; i < 12; i++)
      ids.push((await makeOrder(accounts, who, address.id)).id);
    // newest first: ids[11] is first. One cancelled, one in preparation, one delivered.
    await cancelViaApi(who.token, ids[0]!);
    await adminStatus(ids[1]!, "preparing");
    await adminStatus(ids[2]!, "preparing");
    await adminStatus(ids[2]!, "shipped");
    await adminStatus(ids[2]!, "delivered");

    await signIn(page, who, "/account/orders");
    await expect(rows(page)).toHaveCount(10);
    await expect(rows(page).first()).toHaveAttribute(
      "data-order-id",
      String(ids[11]),
    );
    // Every row shows the order number, a date, the item count and the backend's status label.
    await expect(rows(page).first()).toContainText(`طلب #${ids[11]}`);
    await expect(rows(page).first()).toContainText("قطعة");
    const label = (await orderOf(who.token, ids[11]!)).status_label;
    await expect(rows(page).first().locator(".lm-st")).toHaveText(label);

    // Pager: page 2 has the other two, and a link goes back.
    const pager = page.locator(".lm-pager:visible");
    await pager.getByRole("link", { name: "التالي" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).last()).toHaveAttribute(
      "data-order-id",
      String(ids[0]),
    );
    // A page past the end goes to the last one.
    await page.goto("/account/orders?page=99");
    await expect(page).toHaveURL(/page=2/);

    // Filters: in progress, completed, cancelled.
    await chip(page, "active").click();
    await expect(page).toHaveURL(/status=active/);
    await expect(chip(page, "active")).toHaveAttribute("aria-current", "true");
    await expect(rows(page)).toHaveCount(10);
    // 12 orders minus the cancelled and the delivered one: exactly one page, no pager.
    await expect(page.locator(".lm-pager:visible")).toHaveCount(0);
    await chip(page, "completed").click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toHaveAttribute(
      "data-order-id",
      String(ids[2]),
    );
    await chip(page, "cancelled").click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toHaveAttribute(
      "data-order-id",
      String(ids[0]),
    );
    await expect(rows(page).first().locator(".lm-st")).toHaveText("ملغى");
    await chip(page, "all").click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(rows(page)).toHaveCount(10);
  });

  test("an empty list says so and offers to start shopping", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "noorders");
    await signIn(page, who, "/account/orders");
    await expect(page.getByText("لا توجد طلبات بعد")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ابدأ التسوق" }),
    ).toHaveAttribute("href", "/");
    await page.goto("/account/orders?status=completed");
    await expect(page.getByText("لا توجد طلبات في هذا التصنيف")).toBeVisible();
  });

  test("the pages are private (noindex) and reachable only when signed in", async ({
    page,
    browser,
    accounts,
  }) => {
    const who = await customer(accounts, "private");
    await signIn(page, who, "/account/orders");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    const guest = await browser.newContext({ locale: "ar" });
    const guestPage = await guest.newPage();
    for (const path of [
      "/account/orders",
      "/account/orders/1",
      "/account/addresses",
      "/checkout",
    ]) {
      await guestPage.goto(path);
      await expect(guestPage, path).toHaveURL(/\/login\?next=/);
    }
    await guest.close();
  });
});

test.describe("order page", () => {
  test("shows the timeline, the items, the delivery, the address, the payment and the totals", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "detail");
    const address = await addAddress(who.token, DAMASCUS);
    await addToCart(who.token, SYP_PRODUCT, 2);
    await addToCart(who.token, USD_PRODUCT, 1);
    const totals = await expectedTotals(who.token, "damascus", COURIER);
    const order = await placeOrderViaApi(
      accounts,
      who.token,
      address.id,
      COURIER,
      totals,
    );

    await signIn(page, who, `/account/orders/${order.id}`);
    await expect(page.locator("h1:visible")).toContainText(`طلب #${order.id}`);
    await expect(page.locator(".lm-pg:visible .lm-st").first()).toHaveText(
      order.status_label,
    );

    // The timeline is the backend's: every step, the first reached and current.
    const steps = page.locator(".lm-timeline:visible li");
    await expect(steps).toHaveCount(order.timeline.length);
    await expect(steps.first()).toHaveClass(/now/);
    await expect(steps.first()).toContainText(
      order.timeline[0]!.status === "pending" ? "تم استلام طلبك" : "",
    );
    await expect(steps.nth(1)).not.toHaveClass(/done/);

    const summary = page.locator("[data-testid=order-summary]:visible");
    await expect(summary).toContainText("×2");
    for (const item of order.items)
      await expect(summary).toContainText(item.name);
    // Products still live link to their page.
    await expect(summary.locator("a[href^='/p/']").first()).toBeVisible();
    await expect(
      page.locator("[data-testid=delivery-row]:visible"),
    ).toContainText(order.delivery.name);
    await expect(
      page.locator("[data-testid=payment-row]:visible"),
    ).toContainText("عند الاستلام");
    await expect(
      page.locator("[data-testid=address-row]:visible"),
    ).toContainText("المزة");
    await expect(
      page.locator("[data-testid=address-row]:visible"),
    ).toContainText(DAMASCUS.details);
    const link = page.locator("[data-testid=map-link]:visible");
    await expect(link).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/?mlat=33.513800&mlon=36.276500#map=16/33.513800/36.276500",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    // Per-currency totals, each in its own currency.
    const total = page.locator("[data-testid=totals]:visible");
    await expect(total).toContainText(price(totals.SYP!, "SYP"));
    await expect(total).toContainText(price(totals.USD!, "USD"));
  });

  test("follows the store's status changes", async ({ page, accounts }) => {
    const who = await customer(accounts, "timeline");
    const address = await addAddress(who.token, ALEPPO);
    const order = await makeOrder(accounts, who, address.id);
    await signIn(page, who, `/account/orders/${order.id}`);
    await expect(page.getByTestId("cancel-order")).toBeVisible();

    await adminStatus(order.id, "preparing");
    await page.reload();
    const preparing = (await orderOf(who.token, order.id)).status_label;
    await expect(page.locator(".lm-pg:visible .lm-st").first()).toHaveText(
      preparing,
    );
    await expect(page.locator(".lm-timeline:visible li.now")).toContainText(
      preparing,
    );
    await expect(page.locator(".lm-timeline:visible li.done")).toHaveCount(2);
    // Only a pending order can be cancelled by the customer.
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);

    await adminStatus(order.id, "shipped");
    await adminStatus(order.id, "delivered");
    await page.reload();
    await expect(page.locator(".lm-timeline:visible li.done")).toHaveCount(4);
    await expect(
      page.locator("[data-testid=payment-row]:visible"),
    ).toContainText("تم الدفع");
  });

  test("anyone else's order, or one that does not exist, is not found", async ({
    page,
    accounts,
  }) => {
    const owner = await customer(accounts, "own");
    const address = await addAddress(owner.token, ALEPPO);
    const order = await makeOrder(accounts, owner, address.id);
    const other = await customer(accounts, "intruder");
    await signIn(page, other, "/");
    expect((await page.goto(`/account/orders/${order.id}`))?.status()).toBe(
      404,
    );
    expect((await page.goto("/account/orders/999999999"))?.status()).toBe(404);
    expect((await page.goto("/account/orders/abc"))?.status()).toBe(404);
    // Neither shows the order's data.
    await expect(page.getByText(`#${order.id}`)).toHaveCount(0);
  });
});

test.describe("cancelling", () => {
  test("a pending order: confirmation dialog with a reason, then cancelled", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "cancel");
    const address = await addAddress(who.token, ALEPPO);
    const order = await makeOrder(accounts, who, address.id);
    await signIn(page, who, `/account/orders/${order.id}`);
    await page.waitForLoadState("networkidle");

    await page.getByTestId("cancel-order").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("إلغاء الطلب؟");
    // "تراجع" keeps the order.
    await dialog.getByRole("button", { name: "تراجع" }).click();
    await expect(dialog).toBeHidden();
    expect((await orderOf(who.token, order.id)).status).toBe("pending");

    await page.getByTestId("cancel-order").click();
    await page
      .getByRole("dialog")
      .getByLabel("سبب الإلغاء (اختياري)")
      .fill("غيّرت رأيي");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "تأكيد الإلغاء" })
      .click();
    await expect(page.locator(".lm-pg:visible .lm-st").first()).toHaveText(
      "ملغى",
    );
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);
    await expect(
      page.locator(".lm-timeline:visible li.cancelled"),
    ).toContainText("غيّرت رأيي");
    const after = await orderOf(who.token, order.id);
    expect(after.status).toBe("cancelled");
    await expect(page.locator(".lm-toast").first()).toContainText(
      "تم إلغاء الطلب",
    );
  });

  test("an order the store already moved on: the backend's message, and the page refreshes", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "late");
    const address = await addAddress(who.token, ALEPPO);
    const order = await makeOrder(accounts, who, address.id);
    await signIn(page, who, `/account/orders/${order.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("cancel-order")).toBeVisible();

    await adminStatus(order.id, "preparing");
    await page.getByTestId("cancel-order").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "تأكيد الإلغاء" })
      .click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "لا يمكن إلغاء هذا الطلب الآن.",
    );
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);
    const preparing = (await orderOf(who.token, order.id)).status_label;
    await expect(page.locator(".lm-pg:visible .lm-st").first()).toHaveText(
      preparing,
    );
  });
});

test.describe("reorder", () => {
  test("puts the items back in the cart with a summary toast and the badge", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "reorder");
    const address = await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 2);
    await addToCart(who.token, USD_PRODUCT, 1);
    const totals = await expectedTotals(who.token, "aleppo", PROVINCE);
    const order = await placeOrderViaApi(
      accounts,
      who.token,
      address.id,
      PROVINCE,
      totals,
    );
    expect(
      (
        await call<{ lines_count: number }>("GET", "/cart", {
          token: who.token,
        })
      ).lines_count,
    ).toBe(0);

    await signIn(page, who, `/account/orders/${order.id}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("reorder").click();
    await expect(page.locator(".lm-toast").first()).toContainText("أعدنا");
    await expect(page.locator(".lm-toast").first()).toContainText("إلى سلتك");
    await expect(
      page.locator('.lm-dicons a[aria-label="السلة"] .lm-badge'),
    ).toHaveText("3");
    const cart = await call<{ lines: unknown[]; items_count: number }>(
      "GET",
      "/cart",
      {
        token: who.token,
      },
    );
    expect(cart.lines).toHaveLength(2);
    expect(cart.items_count).toBe(3);

    await page.getByTestId("reorder-cart-link").click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator(".lm-line:visible")).toHaveCount(2);
  });
});

test.describe("without JavaScript", () => {
  test("the list, the order page, cancelling and reordering work as plain pages and forms", async ({
    browser,
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "nojs");
    const address = await addAddress(who.token, DAMASCUS);
    const first = await makeOrder(accounts, who, address.id, "damascus");
    const second = await makeOrder(
      accounts,
      who,
      address.id,
      "damascus",
      SYP_PRODUCT,
    );
    await signIn(page, who, "/");
    const plain = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();

    await nojs.goto("/account/orders");
    await expect(nojs.locator(".lm-order-row")).toHaveCount(2);
    await nojs.locator('.lm-chips a[data-filter="active"]').click();
    await expect(nojs).toHaveURL(/status=active/);
    await nojs.locator(".lm-order-row").first().click();
    await expect(nojs).toHaveURL(new RegExp(`/account/orders/${second.id}`));
    await expect(nojs.locator(".lm-timeline li")).toHaveCount(4);
    await expect(nojs.locator("[data-testid=map-link]")).toBeVisible();

    // Reorder: a plain form post that lands on the cart (with the same toast, CSS-only).
    await nojs.getByRole("button", { name: "إعادة الطلب" }).click();
    await expect(nojs).toHaveURL(/\/cart$/);
    await expect(nojs.locator(".lm-line")).toHaveCount(1);
    await expect(nojs.locator(".lm-toast")).toContainText("أعدنا");

    // Cancel: the disclosure form.
    await nojs.goto(`/account/orders/${first.id}`);
    await nojs.locator(".lm-gift > summary").click();
    await nojs.locator("textarea[name=reason]").fill("بدون جافاسكربت");
    await nojs.getByRole("button", { name: "تأكيد الإلغاء" }).click();
    await expect(nojs).toHaveURL(new RegExp(`/account/orders/${first.id}`));
    await expect(nojs.locator(".lm-pg .lm-st").first()).toHaveText("ملغى");
    expect((await orderOf(who.token, first.id)).status).toBe("cancelled");
    await plain.close();
  });
});
