import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  ["/", "Your shop is ready for the day."],
  ["/approvals", "Decisions"],
  ["/inbox", "Customer inbox"],
  ["/ledger", "Ledger desk"],
  ["/night-shift", "Night shift"],
  ["/orders", "Orders"],
  ["/inventory", "Stock"],
  ["/evidence", "How Duka worked"],
] as const;

test.describe("control room release candidate", () => {
  for (const [path, heading] of routes) {
    test(`${heading} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
      await expect(page.getByText("Foundation route is ready")).toHaveCount(0);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("shell remains usable across release widths", async ({ page }, testInfo) => {
    for (const width of [390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Your shop is ready for the day." })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`morning-brief-${width}.png`), fullPage: true });
      if (width < 768) {
        await page.getByRole("button", { name: "Open all navigation" }).click();
        await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }

    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/");
    const documentWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client);
  });

  test("keyboard command navigation is visible and non-destructive", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focusStyle = await page.locator(":focus").evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).not.toBe("0px");
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Duka command menu" })).toBeVisible();
    await page.getByPlaceholder("Go to a Duka workspace…").fill("How Duka");
    await page.getByRole("option", { name: "How Duka worked" }).click();
    await expect(page).toHaveURL(/\/evidence$/);
    await expect(page.getByRole("heading", { name: "How Duka worked" })).toBeVisible();
  });

  test("new product surfaces expose their truthful boundaries", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByText("Names and prices are re-derived by the backend.")).toBeVisible();
    await page.getByRole("button", { name: "Record sale" }).click();
    await expect(page.getByRole("dialog", { name: "Record a catalog-grounded sale" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/inventory");
    await expect(page.getByText("No supplier order or payment is sent.")).toBeVisible();

    await page.goto("/evidence");
    await expect(page.getByText("Evidence fails closed")).toBeVisible();
    await expect(page.getByText("ADK model evaluation")).toBeVisible();
  });

  test("manual sale sends only catalog keys and renders the authoritative total", async ({ page }) => {
    let submittedBody: unknown = null;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/api/orders")) {
        submittedBody = request.postDataJSON();
      }
    });

    await page.goto("/orders");
    await page.getByRole("button", { name: "Record sale" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a catalog-grounded sale" });
    await dialog.getByLabel("Customer").selectOption("254711000001");
    await dialog.getByLabel("Product").selectOption("UNGA-2KG");
    await dialog.getByLabel("Quantity").fill("2");
    await dialog.getByLabel("Mark paid in the books").check();
    await dialog.getByRole("button", { name: "Record sale", exact: true }).click();

    await expect(page.getByText(/Order #\d+ recorded from current catalog prices/)).toBeVisible();
    expect(submittedBody).toEqual({
      customer_id: "254711000001",
      items: [{ sku: "UNGA-2KG", qty: 2 }],
      paid: true,
    });
    await expect(page.getByRole("row").filter({ hasText: "Mama Achieng" }).first()).toContainText("2× Unga wa Dola 2kg");
    await expect(page.getByRole("row").filter({ hasText: "Mama Achieng" }).first()).toContainText(/Ksh\s*390/);
  });

  test("restock scan is idempotent and the owner can reject the one draft", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "Run shelf scan" }).click();
    await expect(page.getByRole("status")).toContainText("One owner-reviewed draft was created");
    await page.getByRole("button", { name: "Run shelf scan" }).click();
    await expect(page.getByRole("status")).toContainText("already pending");

    await page.goto("/approvals");
    await expect(page.getByText("1 waiting decision")).toBeVisible();
    await page.getByRole("button", { name: "Reject draft" }).click();
    const confirmation = page.getByRole("alertdialog");
    const decisionResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().includes("/api/approvals/")
    ));
    await confirmation.getByRole("button", { name: "Reject draft" }).click();
    const firstResponse = await decisionResponse;
    await expect(page.getByRole("status")).toContainText("Rejected exactly once");
    await expect(page.getByText("The queue is clear")).toBeVisible();

    const replay = await page.request.post(firstResponse.url(), {
      data: { decision: "rejected" },
      headers: { "content-type": "application/json" },
    });
    expect(replay.ok()).toBeTruthy();
    expect(await replay.json()).toMatchObject({ ok: true, idempotent: true, decision: "rejected" });
  });

  test("local night run persists a receipt without claiming Scheduler evidence", async ({ page }) => {
    await page.goto("/night-shift");
    await page.getByRole("button", { name: "Run local exact check" }).click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toContainText("not Gemini evidence, Cloud Run Job evidence, or proof that Cloud Scheduler fired");
    await confirmation.getByRole("button", { name: "Run exact pass" }).click();
    await expect(page.getByText("Local exact report persisted. This is not Scheduler proof.")).toBeVisible();
    await expect(page.getByText("Night shift complete")).toBeVisible();
    await expect(page.getByText("Surface", { exact: true }).first().locator("..")).toContainText("api");
    await expect(page.getByText("This page alone is not scheduler evidence.")).toBeVisible();
  });

  test("inbox preserves an event ID across an uncertain handoff and retry", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/inbound", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "simulated handoff failure" }) });
      } else {
        const payload = route.request().postDataJSON() as { event_id: string };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queued: true, event_id: payload.event_id }) });
      }
    });

    await page.goto("/inbox");
    await page.getByLabel("Message text").fill("Niletee mkate moja");
    await page.getByRole("button", { name: "Queue event" }).click();
    await expect(page.getByText("Handoff uncertain")).toBeVisible();
    const receipt = page.getByText(/queued .* · [a-f0-9]+/);
    const firstReceipt = await receipt.textContent();
    await page.getByRole("button", { name: "Retry same event ID" }).click();
    await expect(page.getByText("Accepted · waiting for worker")).toBeVisible();
    const retriedReceipt = await receipt.textContent();
    expect(retriedReceipt).toBe(firstReceipt);
    expect(attempts).toBe(2);
  });

  test("client authorization failure returns the owner to login", async ({ page }) => {
    await page.goto("/approvals");
    await page.route("**/api/approvals", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "owner session expired" }) }));
    await page.getByRole("button", { name: "Refresh queue" }).click();
    await expect(page).toHaveURL(/\/login\?next=\/approvals$/);
  });
});
