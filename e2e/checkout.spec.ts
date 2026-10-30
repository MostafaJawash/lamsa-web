import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import {
  ALEPPO,
  COURIER,
  DAMASCUS,
  PROVINCE,
  SYP_PRODUCT,
  USD_PRODUCT,
  addAddress,
  addToCart,
  addresses,
  customer,
  ensureStock,
  expectedTotals,
  ordersOf,
  orderOf,
  quotes,
  signIn,
  type Customer,
} from "./support/checkout";
import { price } from "./support/shop";

/**
 * Checkout (logged in): the address, the delivery methods the backend offers for it, cash
 * on delivery, per-currency totals, the order itself and its idempotency. Customers are
 * `e2e-…` accounts made through the API and deleted afterwards (their orders are cancelled
 * first so the stock comes back); the pages are driven through the UI.
 */

test.beforeAll(async () => {
  await ensureStock(SYP_PRODUCT, 60);
  await ensureStock(USD_PRODUCT, 60);
});

const pending = (page: Page) =>
  page.locator("[data-testid=place-order]:visible");
const totalsRow = (page: Page) => page.locator("[data-testid=totals]:visible");
const deliveryRow = (page: Page) =>
  page.locator("[data-testid=delivery-row]:visible");
const checked = (page: Page, name: string) =>
  page.locator(`input[name=${name}]:checked`);

/** Waits until React has attached to the checkout form (radios then re-render the page). */
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector(".lm-co-grid");
    return (
      !!el && Object.keys(el).some((key) => key.startsWith("__reactProps$"))
    );
  });
}

async function openCheckout(page: Page, who: Customer) {
  await signIn(page, who, "/checkout");
  await expect(page).toHaveURL(/\/checkout/);
  await ready(page);
}

function orderIdFrom(url: string): number {
  const match = /\/checkout\/success\/(\d+)/.exec(url);
  if (!match) throw new Error(`not a success URL: ${url}`);
  return Number(match[1]);
}

async function confirm(page: Page, accounts: { order(id: number): void }) {
  await pending(page).click();
  await page.waitForURL(/\/checkout\/success\/\d+/, { timeout: 30_000 });
  const id = orderIdFrom(page.url());
  accounts.order(id);
  return id;
}

test.describe("full checkout", () => {
  test("a Damascus address: the courier is chosen and its fee goes into the SYP total", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    const address = await addAddress(who.token, DAMASCUS);
    await addToCart(who.token, SYP_PRODUCT, 2);
    const cart = await quotes(who.token, "damascus");
    const courier = cart.delivery_quotes.find((q) => q.code === COURIER)!;
    expect(cart.delivery_quotes.map((q) => q.code)).toEqual([COURIER]);
    const totals = await expectedTotals(who.token, "damascus", COURIER);

    await openCheckout(page, who);
    await expect(checked(page, "address_id")).toHaveValue(String(address.id));
    await expect(checked(page, "method")).toHaveValue(COURIER);
    await expect(deliveryRow(page)).toContainText(price(courier.fee, "SYP"));
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    await expect(
      page.locator("[data-testid=payment-cod]:visible"),
    ).toContainText("الدفع عند الاستلام");

    const id = await confirm(page, accounts);
    await expect(page.locator("[data-testid=order-success]")).toContainText(
      `#${id}`,
    );
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    // The badge follows the emptied cart without a reload.
    await expect(
      page.locator('.lm-dicons a[aria-label="السلة"] .lm-badge'),
    ).toHaveCount(0);

    const order = await orderOf(who.token, id);
    expect(order.status).toBe("pending");
    expect(order.delivery.code).toBe(COURIER);
    expect(order.totals).toHaveLength(1);
    expect(order.totals[0]!.shipping_fee).toBe(courier.fee);
    expect(order.totals[0]!.total).toBe(totals.SYP);
    expect(order.payment_method).toBe("cod");
  });

  test("a province address: the carrier-paid note, nothing added to the totals", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    const cart = await quotes(who.token, "aleppo");
    expect(cart.delivery_quotes.map((q) => q.code)).toEqual([PROVINCE]);
    const note = cart.delivery_quotes[0]!.description!;
    const totals = await expectedTotals(who.token, "aleppo", PROVINCE);

    await openCheckout(page, who);
    await expect(checked(page, "method")).toHaveValue(PROVINCE);
    await expect(deliveryRow(page)).toContainText(note);
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    // The subtotal and the total are the same amount: no fee was added.
    expect(Object.keys(totals)).toEqual(["SYP"]);
    expect(totals.SYP).toBe(cart.subtotals[0]!.amount);

    const id = await confirm(page, accounts);
    await expect(page.locator("[data-testid=carrier-note]")).toContainText(
      note,
    );
    const order = await orderOf(who.token, id);
    expect(order.delivery.fee_paid_to_carrier).toBe(true);
    expect(order.totals[0]!.shipping_fee).toBe("0.00");
    expect(order.totals[0]!.total).toBe(cart.subtotals[0]!.amount);
  });

  test("SYP and USD items: two separate totals that are never added", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    const address = await addAddress(who.token, DAMASCUS);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await addToCart(who.token, USD_PRODUCT, 1);
    const cart = await quotes(who.token, "damascus");
    const subtotal = Object.fromEntries(
      cart.subtotals.map((s) => [s.currency, s.amount]),
    );
    const totals = await expectedTotals(who.token, "damascus", COURIER);
    expect(Object.keys(totals)).toEqual(["SYP", "USD"]);
    // The courier fee is SYP: the USD bucket is untouched.
    expect(totals.USD).toBe(subtotal.USD);
    expect(totals.SYP).not.toBe(subtotal.SYP);

    await openCheckout(page, who);
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    await expect(totalsRow(page)).toContainText(price(totals.USD!, "USD"));
    await expect(totalsRow(page).locator(".lm-num")).toHaveCount(2);

    const id = await confirm(page, accounts);
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    await expect(totalsRow(page)).toContainText(price(totals.USD!, "USD"));
    const order = await orderOf(who.token, id);
    expect(order.totals.map((t) => t.currency)).toEqual(["SYP", "USD"]);
    expect(order.totals.find((t) => t.currency === "USD")!.shipping_fee).toBe(
      "0.00",
    );
    expect(address.id).toBeGreaterThan(0);
  });

  test("changing the address re-fetches the delivery methods and keeps the notes", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    const damascus = await addAddress(who.token, DAMASCUS);
    const aleppo = await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    const damascusTotals = await expectedTotals(who.token, "damascus", COURIER);
    const aleppoTotals = await expectedTotals(who.token, "aleppo", PROVINCE);

    await openCheckout(page, who);
    await expect(checked(page, "address_id")).toHaveValue(String(damascus.id));
    await expect(checked(page, "method")).toHaveValue(COURIER);
    await page.locator("#co-notes").fill("اتصل قبل الوصول");

    await page
      .locator("label.lm-radio", {
        has: page.locator(`input[value="${aleppo.id}"]`),
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`address=${aleppo.id}`));
    await expect(checked(page, "method")).toHaveValue(PROVINCE);
    await expect(
      page.locator(`input[name=method][value=${COURIER}]`),
    ).toHaveCount(0);
    await expect(totalsRow(page)).toContainText(
      price(aleppoTotals.SYP!, "SYP"),
    );
    await expect(page.locator("#co-notes")).toHaveValue("اتصل قبل الوصول");

    await page
      .locator("label.lm-radio", {
        has: page.locator(`input[value="${damascus.id}"]`),
      })
      .click();
    await expect(checked(page, "method")).toHaveValue(COURIER);
    await expect(totalsRow(page)).toContainText(
      price(damascusTotals.SYP!, "SYP"),
    );
    await expect(
      page.locator(`input[name=method][value=${PROVINCE}]`),
    ).toHaveCount(0);
  });

  test("notes and a gift message reach the order", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);

    // The gift field is collapsed until asked for.
    const gift = page.locator("#co-gift");
    await expect(gift).toBeHidden();
    await page.getByText("إضافة رسالة هدية").click();
    await expect(gift).toBeVisible();
    await page.locator("#co-notes").fill("الجرس لا يعمل");
    await gift.fill("كل عام وأنتِ بخير");
    await expect(page.getByText("13 / 500")).toBeVisible();

    const id = await confirm(page, accounts);
    const order = await orderOf(who.token, id);
    expect(order.customer_notes).toBe("الجرس لا يعمل");
    expect(order.gift_message).toBe("كل عام وأنتِ بخير");
  });
});

test.describe("addresses inside checkout", () => {
  test("a customer without addresses adds one (no map pin) and goes on", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    await expect(form).toBeVisible();
    await expect(
      page.locator("[data-testid=place-order]:visible"),
    ).toBeDisabled();
    await expect(
      page.getByText("اختر عنوان التوصيل لتظهر طرق التوصيل المتاحة."),
    ).toBeVisible();

    await form
      .locator('[data-field="governorate"]')
      .selectOption({ label: "حلب" });
    await form
      .locator('[data-field="details"]')
      .fill("حي الفرقان قرب الحديقة العامة");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(page).toHaveURL(/\/checkout\?address=\d+/);
    await ready(page);
    await expect(checked(page, "method")).toHaveValue(PROVINCE);

    const [saved] = await addresses(who.token);
    expect(saved!.governorate).toBe("aleppo");
    expect(saved!.latitude).toBeNull();
    expect(saved!.is_default).toBe(true);
    await confirm(page, accounts);
  });

  test("with a map pin the coordinates are saved", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    await form
      .locator('[data-field="governorate"]')
      .selectOption({ label: "دمشق" });
    await form
      .locator('[data-field="details"]')
      .fill("شارع الجلاء، بناء 12، الطابق 3");

    const map = form.locator(".lm-map");
    await expect(map.locator(".leaflet-tile-loaded").first()).toBeVisible({
      timeout: 30_000,
    });
    await map.click({ position: { x: 370, y: 150 } });
    const coords = form.getByTestId("coords");
    await expect(coords).toBeVisible();
    await expect(form.getByTestId("map-status")).toContainText("تم وضع الدبوس");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(page).toHaveURL(/\/checkout\?address=\d+/);

    const [saved] = await addresses(who.token);
    expect(saved!.governorate).toBe("damascus");
    expect(Number(saved!.latitude)).toBeGreaterThan(32.3);
    expect(Number(saved!.latitude)).toBeLessThan(37.4);
    expect(Number(saved!.longitude)).toBeGreaterThan(35.6);
    await ready(page);
    await expect(checked(page, "method")).toHaveValue(COURIER);
  });

  test("a pin outside Syria is refused, in the browser and by the backend", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    await form
      .locator('[data-field="governorate"]')
      .selectOption({ label: "دمشق" });
    await form
      .locator('[data-field="details"]')
      .fill("شارع الجلاء، بناء 12، الطابق 3");
    const map = form.locator(".lm-map");
    await expect(map.locator(".leaflet-tile-loaded").first()).toBeVisible({
      timeout: 30_000,
    });

    // The far left of the map is the Mediterranean, west of Syria's box.
    await map.click({ position: { x: 8, y: 200 } });
    await expect(form.getByTestId("map-status")).toContainText("خارج سوريا");
    await expect(form.getByTestId("coords")).toHaveCount(0);
    await expect(form.locator('input[name="latitude"]')).toHaveValue("");

    // A point the box accepts but with more decimals than the backend takes: the browser
    // lets it through, the backend answers INVALID_LOCATION and its message is shown.
    await form.evaluate((element) => {
      const set = (name: string, value: string) => {
        (
          element.querySelector(`input[name="${name}"]`) as HTMLInputElement
        ).value = value;
      };
      set("latitude", "33.51380012");
      set("longitude", "36.27650012");
    });
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(form.locator('[data-field-error="location"]')).toContainText(
      "الموقع المحدد غير صالح أو خارج سوريا",
    );
    expect(await addresses(who.token)).toHaveLength(0);
  });

  test("the map is operable from the keyboard and announces what happens", async ({
    page,
    accounts,
    context,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 36.2021, longitude: 37.1343 });
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    const map = form.locator(".lm-map");
    await expect(map).toHaveAttribute(
      "aria-label",
      "خريطة اختيار موقع التوصيل",
    );
    await expect(map).toHaveAttribute("role", "group");
    await expect(
      page.locator(".leaflet-control-attribution:visible"),
    ).toContainText("OpenStreetMap");

    await map.focus();
    await page.keyboard.press("Enter");
    const coords = form.getByTestId("coords");
    await expect(coords).toBeVisible();
    const before = await form.locator('input[name="latitude"]').inputValue();
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () =>
        Number(await form.locator('input[name="latitude"]').inputValue()),
      )
      .toBeCloseTo(Number(before) + 0.0005, 5);
    await expect(form.getByTestId("map-status")).toHaveAttribute(
      "aria-live",
      "polite",
    );

    await form.getByRole("button", { name: "إزالة الموقع" }).click();
    await expect(coords).toHaveCount(0);
    await expect(form.getByTestId("map-status")).toContainText("أُزيل الموقع");

    await form.getByRole("button", { name: "استخدم موقعي الحالي" }).click();
    await expect(form.getByTestId("map-status")).toContainText(
      "تم تحديد موقعك",
    );
    await expect(form.locator('input[name="latitude"]')).toHaveValue(
      "36.202100",
    );
  });

  test("a denied or out-of-Syria location leaves the form usable", async ({
    page,
    accounts,
    context,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    await form.getByRole("button", { name: "استخدم موقعي الحالي" }).click();
    await expect(form.getByTestId("map-status")).toContainText("لم يُسمح");

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 52.52, longitude: 13.405 });
    await form.getByRole("button", { name: "استخدم موقعي الحالي" }).click();
    await expect(form.getByTestId("map-status")).toContainText("خارج سوريا");

    await form
      .locator('[data-field="governorate"]')
      .selectOption({ label: "حلب" });
    await form
      .locator('[data-field="details"]')
      .fill("حي الفرقان قرب الحديقة العامة");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(page).toHaveURL(/address=\d+/);
  });

  test("the form checks the limits while typing and the server-side rules after", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const form = page.locator("[data-address-form]:visible");
    const details = form.locator('[data-field="details"]');
    await details.fill("قصير");
    await details.blur();
    await expect(form.locator('[data-field-error="details"]')).toContainText(
      "10 أحرف",
    );
    await expect(form.getByTestId("details-count")).toHaveText("4 / 500");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(
      form.locator('[data-field-error="governorate"]'),
    ).toBeVisible();
    expect(await addresses(who.token)).toHaveLength(0);
  });
});

test.describe("placing the order", () => {
  test("a changed total is refreshed and must be confirmed again with a new attempt", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, DAMASCUS);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const attemptBefore = await page
      .locator('input[name="attempt"]')
      .inputValue();

    // The totals the customer saw are no longer the backend's.
    await page.evaluate(() => {
      (
        document.querySelector(
          'input[name="expected_totals"]',
        ) as HTMLInputElement
      ).value = '{"SYP":"1.00"}';
    });
    await pending(page).click();
    await expect(page).toHaveURL(/notice=price/);
    await expect(page.locator("[data-testid=checkout-notice]")).toContainText(
      "تغيّرت الأسعار أو المجاميع",
    );
    await ready(page);
    const totals = await expectedTotals(who.token, "damascus", COURIER);
    await expect(totalsRow(page)).toContainText(price(totals.SYP!, "SYP"));
    expect(await page.locator('input[name="attempt"]').inputValue()).not.toBe(
      attemptBefore,
    );
    expect(await ordersOf(who.token)).toMatchObject({ total: 0 });

    await confirm(page, accounts);
    expect((await ordersOf(who.token)).total).toBe(1);
  });

  test("a double click makes exactly one order", async ({ page, accounts }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    await pending(page).dblclick();
    await page.waitForURL(/\/checkout\/success\/\d+/, { timeout: 30_000 });
    accounts.order(orderIdFrom(page.url()));
    expect((await ordersOf(who.token)).total).toBe(1);
  });

  test("a replayed form post (retry, stale tab) returns the same order, not a second", async ({
    browser,
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);

    // Without JavaScript the confirm button is a plain multipart POST: capture it, then replay it.
    const state = await page.context().storageState();
    const plain = await browser.newContext({
      storageState: state,
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();
    await nojs.goto("/checkout");
    let captured: { headers: Record<string, string>; body: Buffer } | null =
      null;
    await nojs.route("**/checkout", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && !captured)
        captured = {
          headers: request.headers(),
          body: request.postDataBuffer() ?? Buffer.alloc(0),
        };
      await route.continue();
    });
    await nojs.locator("[data-testid=place-order]").click();
    await nojs.waitForURL(/\/checkout\/success\/\d+/, { timeout: 30_000 });
    const id = orderIdFrom(nojs.url());
    accounts.order(id);
    expect(captured).not.toBeNull();

    const replay = await plain.request.post("/checkout", {
      headers: {
        ...captured!.headers,
        "content-length": String(captured!.body.length),
      },
      data: captured!.body,
      maxRedirects: 0,
    });
    // The server action answers with the redirect to the existing order.
    expect(replay.status()).toBeGreaterThanOrEqual(300);
    expect(replay.status()).toBeLessThan(400);
    expect(replay.headers()["location"] ?? "").toContain(
      `/checkout/success/${id}`,
    );
    expect((await ordersOf(who.token)).total).toBe(1);
    await plain.close();
  });

  test("a delivery method that no longer fits the address refreshes the methods in place", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    const aleppo = await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await signIn(page, who, `/checkout?address=${aleppo.id}&method=${COURIER}`);
    await ready(page);
    // The page already offers only the valid method for Aleppo.
    await expect(checked(page, "method")).toHaveValue(PROVINCE);
    // A stale form still posts the courier for this province address.
    await page.evaluate((code) => {
      const radio =
        document.querySelector<HTMLInputElement>("input[name=method]");
      if (radio) radio.value = code;
    }, COURIER);
    await pending(page).click();
    await expect(page).toHaveURL(/notice=method/);
    await expect(page.locator("[data-testid=checkout-notice]")).toContainText(
      "لم تعد طريقة التوصيل المختارة متاحة",
    );
    await ready(page);
    await expect(checked(page, "method")).toHaveValue(PROVINCE);
    expect((await ordersOf(who.token)).total).toBe(0);
  });
});

test.describe("entering checkout", () => {
  test("an empty cart goes back to the cart", async ({ page, accounts }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await signIn(page, who, "/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("سلتك فارغة")).toBeVisible();
  });

  test("a guest is sent to login and comes back to checkout", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
    await signIn(page, who, "/checkout");
    await expect(page).toHaveURL(/\/checkout$/);
    await ready(page);
  });

  test("the pages are private: noindex and never cached", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await openCheckout(page, who);
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    expect(robots).toContain("noindex");
    const response = await page.request.get("/checkout");
    expect(response.headers()["cache-control"] ?? "").not.toMatch(
      /s-maxage|max-age=[1-9]/,
    );
  });
});

test.describe("success page", () => {
  test("only the owner sees it (404 for anyone else, login for a guest)", async ({
    page,
    browser,
    accounts,
  }) => {
    const owner = await customer(accounts, "owner");
    const address = await addAddress(owner.token, ALEPPO);
    await addToCart(owner.token, SYP_PRODUCT, 1);
    const totals = await expectedTotals(owner.token, "aleppo", PROVINCE);
    const { placeOrderViaApi } = await import("./support/checkout");
    const order = await placeOrderViaApi(
      accounts,
      owner.token,
      address.id,
      PROVINCE,
      totals,
    );

    await signIn(page, owner, `/checkout/success/${order.id}`);
    await expect(page.locator("[data-testid=order-success]")).toContainText(
      `#${order.id}`,
    );
    await expect(
      page.getByRole("link", { name: "تتبّع الطلب" }),
    ).toHaveAttribute("href", `/account/orders/${order.id}`);
    await expect(
      page.getByRole("link", { name: "متابعة التسوق" }),
    ).toHaveAttribute("href", "/");

    const other = await customer(accounts, "other");
    const context = await browser.newContext({ locale: "ar" });
    const otherPage = await context.newPage();
    await signIn(otherPage, other, "/");
    const response = await otherPage.goto(`/checkout/success/${order.id}`);
    expect(response?.status()).toBe(404);
    expect(
      (await otherPage.goto("/checkout/success/999999999"))?.status(),
    ).toBe(404);
    expect((await otherPage.goto("/checkout/success/abc"))?.status()).toBe(404);
    await context.close();

    const guest = await browser.newContext({ locale: "ar" });
    const guestPage = await guest.newPage();
    await guestPage.goto(`/checkout/success/${order.id}`);
    await expect(guestPage).toHaveURL(/\/login\?next=/);
    await guest.close();
  });
});

test.describe("without JavaScript", () => {
  test("checkout, address choice and confirmation work as plain forms", async ({
    browser,
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    const damascus = await addAddress(who.token, DAMASCUS);
    const aleppo = await addAddress(who.token, ALEPPO);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await signIn(page, who, "/");
    const plain = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();
    await nojs.goto("/checkout");
    await expect(
      nojs.locator(`input[name=address_id][value="${damascus.id}"]`),
    ).toBeChecked();
    await expect(
      nojs.locator(`input[name=method][value=${COURIER}]`),
    ).toBeChecked();

    // Pick another address and press the refresh button: the methods follow.
    await nojs
      .locator(`input[name=address_id][value="${aleppo.id}"]`)
      .check({ force: true });
    await nojs.getByRole("button", { name: "تحديث" }).first().click();
    await expect(nojs).toHaveURL(new RegExp(`address=${aleppo.id}`));
    await expect(
      nojs.locator(`input[name=method][value=${PROVINCE}]`),
    ).toBeChecked();
    await expect(
      nojs.locator(`input[name=method][value=${COURIER}]`),
    ).toHaveCount(0);

    await nojs.locator("#co-notes").fill("بدون جافاسكربت");
    await nojs.locator("[data-testid=place-order]").click();
    await nojs.waitForURL(/\/checkout\/success\/\d+/);
    const id = orderIdFrom(nojs.url());
    accounts.order(id);
    await expect(nojs.locator("[data-testid=order-success]")).toBeVisible();
    expect((await orderOf(who.token, id)).customer_notes).toBe(
      "بدون جافاسكربت",
    );
    await plain.close();
  });

  test("a plain address form post shows the errors and then saves", async ({
    browser,
    page,
    accounts,
  }) => {
    const who = await customer(accounts);
    await addToCart(who.token, SYP_PRODUCT, 1);
    await signIn(page, who, "/");
    const plain = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();
    await nojs.goto("/checkout");
    const form = nojs.locator("[data-address-form]");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(
      form.locator('[data-field-error="governorate"]'),
    ).toBeVisible();
    await expect(form.locator('[data-field-error="details"]')).toBeVisible();
    await form
      .locator('[data-field="governorate"]')
      .selectOption({ label: "حمص" });
    await form
      .locator('[data-field="details"]')
      .fill("شارع الحضارة قرب الساعة الجديدة");
    await form.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(nojs).toHaveURL(/address=\d+/);
    expect((await addresses(who.token))[0]!.governorate).toBe("homs");
    await plain.close();
  });
});
