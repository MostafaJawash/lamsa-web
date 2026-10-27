import { expect, test } from "@playwright/test";

test("home page renders in Arabic, right to left", async ({ page }) => {
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "لمسة، متجر تجميل إلكتروني",
  );
  await expect(page).toHaveTitle("لمسة");
});
