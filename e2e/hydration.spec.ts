import { customer, signIn } from "./support/checkout";
import { call } from "./support/backend";
import { listed, product } from "./support/shop";
import { expect, hydrated, test } from "./support/fixtures";

/**
 * Hearts and page styles must not touch React-managed markup before React hydrates it.
 *
 * The server always renders a heart neutral (`aria-pressed="false"`: the HTML is shared
 * and never carries visitor data) and the root layout's controller marks the visitor's
 * favorites afterwards. Home, lists and rails stream inside <Suspense> and hydrate AFTER
 * the layout, so a write made before that makes React report a hydration mismatch
 * ("This won't be patched up") on the attribute. A production build does not log
 * attribute mismatches, so the test watches the cause: every `aria-pressed` / `media`
 * change on a React-managed element must find the element already hydrated (React tags
 * hydrated nodes with `__reactFiber$…`). A `next dev` server also logs the mismatch
 * itself, which is checked too.
 */

const WATCH = () => {
  const early: string[] = [];
  Object.assign(window, { __earlyWrites: early });
  const hydratedNode = (node: Element) => {
    for (const key in node) if (key.startsWith("__reactFiber$")) return true;
    return false;
  };
  new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target as Element;
      if (!hydratedNode(target))
        early.push(`${target.tagName}[${record.attributeName}]`);
    }
  }).observe(document, {
    attributes: true,
    subtree: true,
    attributeFilter: ["aria-pressed", "media"],
  });
};

test("a logged-in visitor's favorites reach the hearts after hydration, without a mismatch", async ({
  page,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "hydration");
  const items = await listed({});
  expect(items.length).toBeGreaterThan(0);
  await Promise.all(
    items.map((item) =>
      call("PUT", `/favorites/${item.id}`, { token: who.token }),
    ),
  );
  const category = (await product(items[0].slug)).category.slug;

  const messages: string[] = [];
  page.on("console", (message) => {
    if (/hydrat|didn't match|aria-pressed/i.test(message.text()))
      messages.push(message.text().slice(0, 300));
  });
  await page.addInitScript(WATCH);
  await signIn(page, who);

  for (const path of ["/", "/new", "/sale", `/c/${category}`]) {
    messages.length = 0;

    // The server-rendered HTML for this very visitor is neutral: nothing is pressed.
    const html = await (await page.request.get(path)).text();
    expect(html, `${path} server HTML`).not.toContain('aria-pressed="true"');

    await page.goto(path);
    await hydrated(page);
    // ...and the client settles on the real state.
    await expect(
      page.locator('.lm-fav[aria-pressed="true"]').first(),
      `${path} pressed heart`,
    ).toBeAttached({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    const early = await page.evaluate(
      () => (window as unknown as { __earlyWrites: string[] }).__earlyWrites,
    );
    expect(early, `${path}: attributes written before hydration`).toEqual([]);
    expect(messages, `${path}: hydration messages`).toEqual([]);
  }
});
