import type { Page } from "@playwright/test";

import { governorateCodes } from "../src/config/governorates";
import { call } from "./support/backend";
import { expect, test } from "./support/fixtures";
import {
  ALEPPO,
  DAMASCUS,
  addAddress,
  addresses,
  customer,
  signIn,
} from "./support/checkout";

/**
 * /account/addresses: the list, add, edit, delete (with a confirmation), the default, the
 * backend's address limit, and privacy. Same shared form as in checkout.
 */

const cards = (page: Page) => page.locator(".lm-addr:visible");
const form = (page: Page) => page.locator("[data-address-form]:visible");

test("the governorate list is the backend's and matches the map config", async ({
  page,
  accounts,
}) => {
  const list = await call<{ code: string; name: string }[]>(
    "GET",
    "/governorates",
  );
  expect(list.map((g) => g.code).sort()).toEqual([...governorateCodes].sort());

  const who = await customer(accounts, "gov");
  await signIn(page, who, "/account/addresses?new=1");
  const options = form(page).locator('[data-field="governorate"] option');
  await expect(options).toHaveCount(15); // the placeholder and the 14
  expect(await options.allTextContents()).toEqual([
    "اختر المحافظة",
    ...list.map((g) => g.name),
  ]);
});

test("empty state, then the first address becomes the default", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "empty");
  await signIn(page, who, "/account/addresses");
  await expect(page.getByText("لا توجد عناوين محفوظة")).toBeVisible();
  await page.getByRole("link", { name: "إضافة عنوان" }).click();
  await expect(page).toHaveURL(/new=1/);

  const f = form(page);
  await f.locator('[data-field="label"]').fill("البيت");
  await f.locator('[data-field="governorate"]').selectOption({ label: "دمشق" });
  await f.locator('[data-field="area"]').fill("المزة");
  await f
    .locator('[data-field="details"]')
    .fill("شارع الجلاء، بناء 12، الطابق 3");
  await f.getByRole("button", { name: "حفظ العنوان" }).click();

  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(cards(page)).toHaveCount(1);
  const card = cards(page).first();
  await expect(card).toContainText("البيت");
  await expect(card).toContainText("دمشق، المزة");
  await expect(card).toContainText("شارع الجلاء، بناء 12، الطابق 3");
  await expect(card.getByTestId("default-badge")).toHaveText("افتراضي");
  await expect(card).not.toContainText("الموقع محدد على الخريطة");
  await expect(page.locator(".lm-toast").first()).toContainText(
    "تم حفظ العنوان",
  );
});

test("a map pin shows as an indicator; editing can change it and the fields", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "edit");
  const saved = await addAddress(who.token, DAMASCUS);
  await signIn(page, who, "/account/addresses");
  const card = cards(page).first();
  await expect(card).toContainText("الموقع محدد على الخريطة");

  await card.getByRole("link", { name: "تعديل" }).click();
  await expect(page).toHaveURL(new RegExp(`edit=${saved.id}`));
  const f = form(page);
  await expect(f.locator('[data-field="details"]')).toHaveValue(
    DAMASCUS.details,
  );
  await expect(f.locator('[data-field="governorate"]')).toHaveValue("damascus");
  await expect(f.getByTestId("coords")).toContainText("33.513800");
  await f
    .locator('[data-field="details"]')
    .fill("شارع بغداد، بناء 4، الطابق 1");
  await f.getByRole("button", { name: "إزالة الموقع" }).click();
  await f.getByRole("button", { name: "حفظ العنوان" }).click();

  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(cards(page).first()).toContainText(
    "شارع بغداد، بناء 4، الطابق 1",
  );
  await expect(cards(page).first()).not.toContainText(
    "الموقع محدد على الخريطة",
  );
  const [after] = await addresses(who.token);
  expect(after!.latitude).toBeNull();
  expect(after!.longitude).toBeNull();
  expect(after!.details).toBe("شارع بغداد، بناء 4، الطابق 1");
});

test("set default, and delete with a confirmation (the default moves on)", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "default");
  const first = await addAddress(who.token, DAMASCUS);
  const second = await addAddress(who.token, ALEPPO);
  await signIn(page, who, "/account/addresses");
  await page.waitForLoadState("networkidle");
  await expect(cards(page)).toHaveCount(2);
  const firstCard = page.locator(
    `.lm-addr[data-address-id="${first.id}"]:visible`,
  );
  const secondCard = page.locator(
    `.lm-addr[data-address-id="${second.id}"]:visible`,
  );
  await expect(firstCard.getByTestId("default-badge")).toBeVisible();
  await expect(secondCard.getByTestId("default-badge")).toHaveCount(0);

  await secondCard.getByRole("button", { name: "تعيين كافتراضي" }).click();
  await expect(secondCard.getByTestId("default-badge")).toBeVisible();
  await expect(firstCard.getByTestId("default-badge")).toHaveCount(0);
  await expect(page.locator(".lm-toast").first()).toContainText(
    "تم تعيين العنوان كافتراضي",
  );

  // Delete: the dialog asks first.
  await secondCard.getByRole("link", { name: "حذف" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("حذف العنوان؟");
  await expect(dialog).toContainText("العمل");
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await expect(cards(page)).toHaveCount(2);

  await secondCard.getByRole("link", { name: "حذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator(".lm-toast").first()).toContainText(
    "تم حذف العنوان",
  );
  // The backend gave the default to the remaining address.
  await expect(firstCard.getByTestId("default-badge")).toBeVisible();
  expect((await addresses(who.token)).map((a) => a.is_default)).toEqual([true]);
});

test("the backend's address limit error is shown with its own message", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "limit");
  for (let i = 0; i < 10; i++)
    await addAddress(who.token, { ...ALEPPO, label: `عنوان ${i + 1}` });
  await signIn(page, who, "/account/addresses?new=1");
  const f = form(page);
  await f.locator('[data-field="governorate"]').selectOption({ label: "حمص" });
  await f
    .locator('[data-field="details"]')
    .fill("شارع الحضارة قرب الساعة الجديدة");
  await f.getByRole("button", { name: "حفظ العنوان" }).click();
  await expect(f.locator('[data-field-error="form"]')).toContainText(
    "وصلت إلى الحد الأقصى من العناوين",
  );
  expect(await addresses(who.token)).toHaveLength(10);
  // The typed values survive the error.
  await expect(f.locator('[data-field="details"]')).toHaveValue(
    "شارع الحضارة قرب الساعة الجديدة",
  );
});

test("someone else's address is not found", async ({ page, accounts }) => {
  const owner = await customer(accounts, "owner");
  const theirs = await addAddress(owner.token, ALEPPO);
  const other = await customer(accounts, "other");
  await signIn(page, other, "/account/addresses");
  expect(
    (await page.goto(`/account/addresses?edit=${theirs.id}`))?.status(),
  ).toBe(404);
  expect(
    (await page.goto(`/account/addresses?delete=${theirs.id}`))?.status(),
  ).toBe(404);
  await page.goto("/account/addresses");
  await expect(page.getByText(ALEPPO.details)).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test("add, edit, set default and delete (with its confirmation page) work as plain forms", async ({
    browser,
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "nojs");
    const first = await addAddress(who.token, DAMASCUS);
    await signIn(page, who, "/");
    const plain = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();
    await nojs.goto("/account/addresses");
    await expect(nojs.locator(".lm-addr")).toHaveCount(1);

    // Add (the map needs JavaScript; the rest is a plain form).
    await nojs.getByRole("link", { name: "+ عنوان جديد" }).click();
    const f = nojs.locator("[data-address-form]");
    await expect(f.locator(".lm-map")).toHaveCount(0);
    await f.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(f.locator('[data-field-error="governorate"]')).toBeVisible();
    await f
      .locator('[data-field="governorate"]')
      .selectOption({ label: "حلب" });
    await f
      .locator('[data-field="details"]')
      .fill("حي الفرقان قرب الحديقة العامة");
    await f.locator('input[name="is_default"]').check();
    await f.getByRole("button", { name: "حفظ العنوان" }).click();
    await expect(nojs).toHaveURL(/\/account\/addresses$/);
    await expect(nojs.locator(".lm-addr")).toHaveCount(2);
    const list = await addresses(who.token);
    const aleppo = list.find((a) => a.governorate === "aleppo")!;
    expect(aleppo.is_default).toBe(true);

    // Set the first one as the default again.
    await nojs
      .locator(`.lm-addr[data-address-id="${first.id}"]`)
      .getByRole("button", { name: "تعيين كافتراضي" })
      .click();
    expect(
      (await addresses(who.token)).find((a) => a.id === first.id)!.is_default,
    ).toBe(true);

    // Edit.
    await nojs
      .locator(`.lm-addr[data-address-id="${aleppo.id}"]`)
      .getByRole("link", { name: "تعديل" })
      .click();
    await nojs
      .locator('[data-address-form] [data-field="area"]')
      .fill("الفرقان");
    await nojs
      .locator("[data-address-form]")
      .getByRole("button", { name: "حفظ العنوان" })
      .click();
    expect(
      (await addresses(who.token)).find((a) => a.id === aleppo.id)!.area,
    ).toBe("الفرقان");

    // Delete: a confirmation panel, not an instant delete.
    await nojs
      .locator(`.lm-addr[data-address-id="${aleppo.id}"]`)
      .getByRole("link", { name: "حذف" })
      .click();
    await expect(nojs).toHaveURL(new RegExp(`delete=${aleppo.id}`));
    // It has no label, so the confirmation names its governorate.
    await expect(nojs.locator(".lm-confirm")).toContainText("حلب");
    expect(await addresses(who.token)).toHaveLength(2);
    await nojs
      .locator(".lm-confirm")
      .getByRole("button", { name: "حذف" })
      .click();
    await expect(nojs.locator(".lm-addr")).toHaveCount(1);
    expect(await addresses(who.token)).toHaveLength(1);
    await plain.close();
  });
});
