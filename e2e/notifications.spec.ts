import type { Page } from "@playwright/test";

import { call } from "./support/backend";
import {
  DAMASCUS,
  SYP_PRODUCT,
  addAddress,
  customer,
  ensureStock,
  makeOrder,
  signIn,
} from "./support/checkout";
import { cookieValue, expect, hydrated, test } from "./support/fixtures";
import {
  inbox,
  sendMessage,
  unreadCount,
  waitForInbox,
} from "./support/notifications";

/**
 * /account/notifications: the empty state, pagination, one and all marked as read, the
 * badges (account tab and navigation link), rows that lead somewhere, the same without
 * JavaScript, and what one customer can never do to another's inbox.
 */

const rows = (page: Page) => page.locator(".lm-notif:visible");
const row = (page: Page, id: number) =>
  page.locator(`.lm-notif[data-notification-id="${id}"]:visible`);
/** The unread count on the navigation link, which every viewport shows. */
const navBadge = (page: Page) =>
  page.locator(
    'nav[aria-label="قائمة الحساب"]:visible .lm-inline-badge .lm-badge',
  );
const toast = (page: Page) => page.locator(".lm-toast").first();

async function open(page: Page, path = "/account/notifications") {
  await page.goto(path);
  await hydrated(page);
}

test.beforeAll(async () => {
  await ensureStock(SYP_PRODUCT, 40);
});

test("an account without notifications sees the empty state and no badge", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "ninbox");
  await signIn(page, who, "/account/notifications");
  await hydrated(page);
  await expect(page.getByText("لا توجد إشعارات بعد")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByTestId("unread-summary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "تعليم الكل كمقروء" }),
  ).toHaveCount(0);
  await expect(navBadge(page)).toHaveCount(0);
  await expect(page.locator(".lm-pager")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "تفضيلات الإشعارات" }),
  ).toHaveAttribute("href", "/account/settings#notifications");
});

test("pages of ten, newest first; one marked read; all marked read; the badges follow", async ({
  page,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "pages");
  for (let n = 1; n <= 12; n++)
    await sendMessage(who.id, `رسالة ${n}`, `نص الرسالة رقم ${n}`);
  const all = await waitForInbox(who.token, 12);
  expect(all.unread_count).toBe(12);

  await signIn(page, who, "/account/notifications");
  await hydrated(page);
  // The backend's order, 10 on the first page.
  await expect(rows(page)).toHaveCount(10);
  const first = all.items[0]!;
  await expect(rows(page).first()).toContainText(first.title);
  await expect(page.getByTestId("unread-summary")).toHaveText(
    "12 إشعارًا غير مقروء",
  );
  await expect(navBadge(page)).toHaveText("12");
  await expect(rows(page).first()).toHaveAttribute("data-read", "false");

  // Page 2: the last two, the pager works.
  await page.locator(".lm-pager a", { hasText: "2" }).first().click();
  await expect(page).toHaveURL(/page=2$/);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).last()).toContainText("رسالة 1");
  const second = all.items[10]!;

  // One marked read from page 2: its look changes, the counts drop by one, the page stays.
  await row(page, second.id)
    .getByRole("button", { name: "تعليم كمقروء" })
    .click();
  await expect(row(page, second.id)).toHaveAttribute("data-read", "true");
  await expect(row(page, second.id).getByRole("button")).toHaveCount(0);
  await expect(page).toHaveURL(/page=2$/);
  await expect(page.getByTestId("unread-summary")).toHaveText(
    "11 إشعارًا غير مقروء",
  );
  await expect(navBadge(page)).toHaveText("11");
  expect(await unreadCount(who.token)).toBe(11);

  // All of them: no badge anywhere, no button, the rows look read.
  await page.getByRole("button", { name: "تعليم الكل كمقروء" }).click();
  await expect(toast(page)).toContainText("تم تعليم جميع الإشعارات كمقروءة");
  await expect(navBadge(page)).toHaveCount(0);
  await expect(page.locator(".lm-acct .lm-badge")).toHaveCount(0);
  await expect(page.getByTestId("unread-summary")).toHaveText(
    "لا توجد إشعارات غير مقروءة",
  );
  await expect(
    page.getByRole("button", { name: "تعليم الكل كمقروء" }),
  ).toHaveCount(0);
  for (const item of await rows(page).all())
    await expect(item).toHaveAttribute("data-read", "true");
  expect(await unreadCount(who.token)).toBe(0);
  const done = await inbox(who.token, 1, 100);
  expect(done.items.every((item) => item.is_read)).toBe(true);
});

test("the account tab badge counts unread notifications on a phone", async ({
  page,
  accounts,
}) => {
  const who = await customer(accounts, "tab");
  await sendMessage(who.id, "رسالة للتبويب", "نص");
  await sendMessage(who.id, "رسالة ثانية", "نص");
  await waitForInbox(who.token, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, who, "/");
  await hydrated(page);
  const badge = page.locator(".lm-tabbar:visible a[href='/account'] .lm-badge");
  await expect(badge).toHaveText("2");
  await page.goto("/account/notifications");
  await hydrated(page);
  await page.getByRole("button", { name: "تعليم الكل كمقروء" }).click();
  await expect(badge).toHaveCount(0);
});

test("a notification with a link marks itself read and goes there", async ({
  page,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "link");
  const address = await addAddress(who.token, DAMASCUS);
  // The store's message with a product link, and the order the customer places.
  await sendMessage(who.id, "عرض خاص", "تسوّق الآن", {
    type: "product",
    value: "demo-velvet-lipstick",
  });
  await sendMessage(who.id, "بلا رابط", "نص فقط");
  const order = await makeOrder(accounts, who, address.id, "damascus");
  const all = await waitForInbox(who.token, 3);
  const product = all.items.find((item) => item.title === "عرض خاص")!;
  const plain = all.items.find((item) => item.title === "بلا رابط")!;
  const placed = all.items.find((item) => item.order_id === order.id)!;
  expect(placed).toBeTruthy();

  await signIn(page, who, "/account/notifications");
  await hydrated(page);
  // A row without a target is not a link: no button around it.
  await expect(
    row(page, plain.id).locator(".lm-notif-open button"),
  ).toHaveCount(0);
  await expect(navBadge(page)).toHaveText("3");

  await row(page, product.id).locator(".lm-notif-open button").click();
  await page.waitForURL("**/p/demo-velvet-lipstick");
  await expect.poll(() => unreadCount(who.token)).toBe(2);

  await page.goto("/account/notifications");
  await hydrated(page);
  await expect(row(page, product.id)).toHaveAttribute("data-read", "true");
  await row(page, placed.id).locator(".lm-notif-open button").click();
  await page.waitForURL(`**/account/orders/${order.id}`);
  await expect.poll(() => unreadCount(who.token)).toBe(1);
});

test("without JavaScript: pages, mark read, mark all and a notification link", async ({
  page,
  browser,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "nojs-inbox");
  const other = await customer(accounts, "nojs-other");
  for (let n = 1; n <= 11; n++)
    await sendMessage(
      who.id,
      `رسالة ${n}`,
      "نص",
      n === 11 ? { type: "sale" } : undefined,
    );
  await sendMessage(other.id, "لغيرك", "خاص");
  const all = await waitForInbox(who.token, 11);
  await waitForInbox(other.token, 1);
  const secret = (await inbox(other.token)).items[0]!;

  await signIn(page, who, "/");
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
    locale: "ar",
  });
  const nojs = await context.newPage();
  await nojs.goto("/account/notifications");
  await expect(nojs.locator(".lm-notif")).toHaveCount(10);
  await expect(nojs.getByTestId("unread-summary")).toHaveText(
    "11 إشعارًا غير مقروء",
  );

  // Pagination is plain links.
  await nojs.locator(".lm-pager a", { hasText: "2" }).first().click();
  await expect(nojs).toHaveURL(/page=2$/);
  await expect(nojs.locator(".lm-notif")).toHaveCount(1);
  const oldest = all.items[10]!;
  await nojs
    .locator(`.lm-notif[data-notification-id="${oldest.id}"]`)
    .getByRole("button", { name: "تعليم كمقروء" })
    .click();
  await expect(nojs).toHaveURL(/page=2$/);
  await expect(
    nojs.locator(`.lm-notif[data-notification-id="${oldest.id}"]`),
  ).toHaveAttribute("data-read", "true");
  expect(await unreadCount(who.token)).toBe(10);

  // Someone else's notification id, posted from this customer's form: refused, theirs untouched.
  await nojs.goto("/account/notifications");
  const target = all.items[1]!;
  const rowOf = nojs.locator(`.lm-notif[data-notification-id="${target.id}"]`);
  await rowOf.locator('input[name="id"]').evaluate((input, value) => {
    (input as HTMLInputElement).value = value;
  }, String(secret.id));
  await rowOf.getByRole("button", { name: "تعليم كمقروء" }).click();
  expect(await unreadCount(other.token)).toBe(1);
  expect((await inbox(other.token)).items[0]!.is_read).toBe(false);
  await expect(nojs.locator(".lm-toast").first()).toContainText(
    "الإشعار غير موجود",
  );

  // A row with a link: one click reads it and leads there.
  await nojs.goto("/account/notifications");
  const linked = all.items.find((item) => item.link.type === "sale")!;
  await nojs
    .locator(
      `.lm-notif[data-notification-id="${linked.id}"] .lm-notif-open button`,
    )
    .click();
  await expect(nojs).toHaveURL(/\/sale$/);
  expect(await unreadCount(who.token)).toBe(9);

  // Mark all.
  await nojs.goto("/account/notifications");
  await nojs.getByRole("button", { name: "تعليم الكل كمقروء" }).click();
  await expect(nojs).toHaveURL(/\/account\/notifications$/);
  await expect(nojs.getByTestId("unread-summary")).toHaveText(
    "لا توجد إشعارات غير مقروءة",
  );
  expect(await unreadCount(who.token)).toBe(0);
  expect(await unreadCount(other.token)).toBe(1);
  await context.close();
});

test("the backend refuses another customer's notification; no token in the pages", async ({
  page,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "own");
  const other = await customer(accounts, "foreign");
  await sendMessage(other.id, "لغيرك فقط", "خاص");
  const theirs = (await waitForInbox(other.token, 1)).items[0]!;
  await expect(
    call("POST", `/notifications/${theirs.id}/read`, { token: who.token }),
  ).rejects.toMatchObject({ status: 404, code: "NOTIFICATION_NOT_FOUND" });

  await sendMessage(who.id, "رسالتي", "نص");
  await waitForInbox(who.token, 1);
  const bodies: string[] = [];
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/javascript|x-component|json|html/.test(type))
      bodies.push(await response.text().catch(() => ""));
  });
  await signIn(page, who, "/account/notifications");
  const access = (await cookieValue(page, "__Host-lamsa_at")) ?? "";
  const refresh = (await cookieValue(page, "__Host-lamsa_rt")) ?? "";
  expect(access.length).toBeGreaterThan(20);
  for (const path of ["/account/notifications", "/account/settings"]) {
    await open(page, path);
    const html = await page.content();
    expect(html, path).not.toContain(access);
    expect(html, path).not.toContain(refresh);
    expect(html, path).not.toContain("لغيرك فقط");
    const raw = await (await page.request.get(path)).text();
    expect(raw, path).not.toContain(access);
    expect(raw, path).not.toContain(refresh);
  }
  // The actions' own responses (RSC payloads) carry no token either.
  await open(page, "/account/notifications");
  await page.getByRole("button", { name: "تعليم الكل كمقروء" }).click();
  await expect(page.getByTestId("unread-summary")).toHaveText(
    "لا توجد إشعارات غير مقروءة",
  );
  for (const body of bodies) {
    expect(body.includes(access)).toBe(false);
    expect(body.includes(refresh)).toBe(false);
  }
  expect(await unreadCount(other.token)).toBe(1);
});
