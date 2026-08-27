import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("judge profile opens with meaningful evidence and bilingual history", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Your shop is ready for the day." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /3,874.*settled exactly/ })).toBeVisible();
  await expect(page.getByText(/97\.2% of 3,986 statement rows/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Review 3 decisions" })).toBeVisible();
  await expect(page.getByText("Restock draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Ledger row", { exact: true })).toBeVisible();
  await expect(page.getByText("Uncertain order", { exact: true })).toBeVisible();

  const desktopA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(desktopA11y.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("judge-morning-1440.png"), fullPage: true });

  await page.goto("/inbox");
  const customerSearch = page.getByPlaceholder("Find a customer");
  await customerSearch.fill("Mama Achieng");
  await page.getByRole("button", { name: "Mama Achieng", exact: true }).click();
  await expect(page.getByText("Niletee unga mbili na mafuta moja tafadhali.")).toBeVisible();
  await page.getByText("Rehearsal receipt").click();
  await expect(page.getByText("Synthetic deterministic seed")).toBeVisible();
  await expect(page.getByText("It is not presented as a live model invocation.")).toBeVisible();

  await customerSearch.fill("Ali Mohammed");
  await page.getByRole("button", { name: "Ali Mohammed", exact: true }).click();
  await expect(page.getByText("Please prepare one bag of Pishori rice and one litre of cooking oil.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Review 3 decisions" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /3,874.*settled exactly/ })).toBeVisible();
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await page.screenshot({ path: testInfo.outputPath("judge-morning-390.png"), fullPage: true });
});
