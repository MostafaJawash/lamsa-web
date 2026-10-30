import type { Page } from "@playwright/test";

import { call } from "./support/backend";
import { expect, test } from "./support/fixtures";
import {
  ALEPPO,
  COURIER,
  DAMASCUS,
  PROVINCE,
  SYP_PRODUCT,
  SYP_PRODUCT_2,
  addAddress,
  addToCart,
  customer,
  ensureStock,
  expectedTotals,
  ordersOf,
  placeOrderViaApi,
  signIn,
} from "./support/checkout";
import {
  adminToken,
  price,
  product,
  setActive,
  setStock,
} from "./support/shop";

/**
 * Checkout behaviours that need a store-wide change (a delivery fee, stock, a product
 * switched off). They run in the `stock` project, alone and after the parallel tests, and
 * restore what they changed.
 */

test.describe.configure({ mode: "serial" });

type Method = { id: number; code: string; fee: string };

async function courier(): Promise<Method> {
  const methods = await call<Method[]>("GET", "/admin/delivery-methods", {
    token: await adminToken(),
  });
  return methods.find((m) => m.code === COURIER)!;
}

async function setFee(id: number, fee: string) {
  await call("PATCH", `/admin/delivery-methods/${id}`, {
    token: await adminToken(),
    body: { fee },
  });
}

async function ready(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector(".lm-co-grid");
    return (
      !!el && Object.keys(el).some((key) => key.startsWith("__reactProps$"))
    );
  });
}

test("the delivery fee changes while the customer looks at checkout: refreshed totals, a notice, a new confirmation", async ({
  page,
  accounts,
}) => {
  await ensureStock(SYP_PRODUCT, 40);
  const method = await courier();
  const oldFee = method.fee;
  const newFee = "17500.00";
  const who = await customer(accounts, "fee");
  await addAddress(who.token, DAMASCUS);
  await addToCart(who.token, SYP_PRODUCT, 1);
  try {
    await signIn(page, who, "/checkout");
    await ready(page);
    const attempt = await page.locator('input[name="attempt"]').inputValue();
    await expect(
      page.locator("[data-testid=delivery-row]:visible"),
    ).toContainText(price(oldFee, "SYP"));

    await setFee(method.id, newFee);
    await page.locator("[data-testid=place-order]:visible").click();
    await expect(page).toHaveURL(/notice=price/);
    await expect(page.locator("[data-testid=checkout-notice]")).toContainText(
      "تغيّرت الأسعار أو المجاميع",
    );
    await ready(page);
    // The fee shown is the backend's current one (the cache can lag a little).
    await expect
      .poll(
        async () => {
          await page.reload();
          return (
            await page.locator("[data-testid=delivery-row]:visible").innerText()
          ).replace(/\s+/g, " ");
        },
        { timeout: 90_000 },
      )
      .toContain(price(newFee, "SYP"));
    expect(await page.locator('input[name="attempt"]').inputValue()).not.toBe(
      attempt,
    );
    expect((await ordersOf(who.token)).total).toBe(0);

    await ready(page);
    await page.locator("[data-testid=place-order]:visible").click();
    await page.waitForURL(/\/checkout\/success\/\d+/, { timeout: 30_000 });
    const id = Number(/success\/(\d+)/.exec(page.url())![1]);
    accounts.order(id);
    const order = await call<{ totals: { shipping_fee: string }[] }>(
      "GET",
      `/orders/${id}`,
      {
        token: who.token,
      },
    );
    expect(order.totals[0]!.shipping_fee).toBe(newFee);
  } finally {
    await setFee(method.id, oldFee);
  }
});

test("a cart with issues is sent back to the cart, with the issue shown there", async ({
  page,
  accounts,
}) => {
  await ensureStock(SYP_PRODUCT_2, 30);
  const detail = await product(SYP_PRODUCT_2);
  const who = await customer(accounts, "issues");
  await addAddress(who.token, ALEPPO);
  await addToCart(who.token, SYP_PRODUCT_2, 2);
  const before = await setStock(detail.id, 30);
  try {
    await signIn(page, who, "/checkout");
    await expect(page).toHaveURL(/\/checkout$/);
    await page.waitForLoadState("networkidle");
    await setStock(detail.id, 0);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator(".lm-cart-notice")).toBeVisible();
    await expect(page.locator(".lm-line.out:visible")).toHaveCount(1);
    await expect(page.getByText("نفدت الكمية").first()).toBeVisible();
    // The cart page itself keeps checkout disabled until the issue is resolved.
    await expect(
      page.getByRole("button", { name: "إتمام الطلب" }),
    ).toBeDisabled();
  } finally {
    await setStock(detail.id, Math.max(before, 30));
  }
});

test("not enough stock at confirmation goes back to the cart with the available quantity", async ({
  page,
  accounts,
}) => {
  await ensureStock(SYP_PRODUCT_2, 30);
  const detail = await product(SYP_PRODUCT_2);
  const who = await customer(accounts, "stock");
  await addAddress(who.token, ALEPPO);
  await addToCart(who.token, SYP_PRODUCT_2, 2);
  const before = await setStock(detail.id, 30);
  try {
    await signIn(page, who, "/checkout");
    await ready(page);
    await setStock(detail.id, 1);
    await page.locator("[data-testid=place-order]:visible").click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect((await ordersOf(who.token)).total).toBe(0);
    await expect(page.locator(".lm-line:visible")).toContainText(
      "لم يتبقَّ سوى 1",
    );
  } finally {
    await setStock(detail.id, Math.max(before, 30));
  }
});

test("reorder reports what was skipped: an unavailable product stays out of the cart", async ({
  page,
  accounts,
}) => {
  await ensureStock(SYP_PRODUCT, 40);
  await ensureStock(SYP_PRODUCT_2, 40);
  const gone = await product(SYP_PRODUCT);
  const who = await customer(accounts, "skip");
  const address = await addAddress(who.token, ALEPPO);
  await addToCart(who.token, SYP_PRODUCT, 1);
  await addToCart(who.token, SYP_PRODUCT_2, 1);
  const totals = await expectedTotals(who.token, "aleppo", PROVINCE);
  const order = await placeOrderViaApi(
    accounts,
    who.token,
    address.id,
    PROVINCE,
    totals,
  );
  await setActive(gone.id, false);
  try {
    await signIn(page, who, `/account/orders/${order.id}`);
    await page.waitForLoadState("networkidle");
    // The removed product no longer links to its page; the other one still does.
    await expect(
      page.locator("[data-testid=order-summary]:visible a[href^='/p/']"),
    ).toHaveCount(1);
    await page.getByTestId("reorder").click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "عُدّلت بعض المنتجات",
    );
    const cart = await call<{ lines: { product: { slug: string } }[] }>(
      "GET",
      "/cart",
      {
        token: who.token,
      },
    );
    expect(cart.lines.map((l) => l.product.slug)).toEqual([SYP_PRODUCT_2]);
  } finally {
    await setActive(gone.id, true);
  }
});
