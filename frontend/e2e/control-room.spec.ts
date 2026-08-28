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

  test("public HTML enforces the release and browser security boundary", async ({ page, request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    const html = await response.text();
    const policy = headers["content-security-policy"] ?? "";
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy.match(/script-src[^;]*/u)?.[0]).not.toContain("unsafe-inline");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(html).toContain('data-dpl-id="playwright-local"');

    const cspErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /content security policy|refused to/u.test(message.text().toLowerCase())) {
        cspErrors.push(message.text());
      }
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your shop is ready for the day." })).toBeVisible();
    expect(cspErrors).toEqual([]);

    const version = await (await request.get("/version")).json() as {
      deployment_id: string;
      release_sha: string;
    };
    expect(version).toMatchObject({ deployment_id: "playwright-local", release_sha: "playwright-local" });
  });

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

  test("every owner route has a clean provenance-aware print state", async ({ page }) => {
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
      await expect(page.getByText("Duka Autopilot · Duka la Amani")).toBeVisible();
      await expect(page.locator("[data-print-hide]").first()).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });

  test("critical production build stays inside lab performance budgets", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, interactionDurations: [] as number[] };
      (window as typeof window & { __dukaLabMetrics?: typeof metrics }).__dukaLabMetrics = metrics;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.lcp = Math.max(metrics.lcp, entry.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes("event")) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const event = entry as PerformanceEntry & { interactionId?: number; duration: number };
            if (event.interactionId) metrics.interactionDurations.push(event.duration);
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
      }
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your shop is ready for the day." })).toBeVisible();
    await page.getByRole("button", { name: "Open owner menu" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const result = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const metrics = (window as typeof window & { __dukaLabMetrics?: { lcp: number; cls: number; interactionDurations: number[] } }).__dukaLabMetrics;
      return {
        ttfb_ms: navigation.responseStart,
        lcp_ms: metrics?.lcp ?? 0,
        cls: metrics?.cls ?? 0,
        max_observed_interaction_ms: Math.max(0, ...(metrics?.interactionDurations ?? [])),
        environment: "local production build; not hosted field data",
      };
    });
    await testInfo.attach("lab-performance.json", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
    expect(result.ttfb_ms).toBeLessThan(800);
    expect(result.lcp_ms).toBeGreaterThan(0);
    expect(result.lcp_ms).toBeLessThan(2_500);
    expect(result.cls).toBeLessThan(0.1);
    expect(result.max_observed_interaction_ms).toBeLessThanOrEqual(200);
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

  test("ledger keeps source and result legible as focused mobile views", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ledger");

    const source = page.getByRole("tab", { name: "Source" });
    const result = page.getByRole("tab", { name: "Result" });
    await expect(source).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Page input" })).toBeVisible();

    await result.click();
    await expect(result).toHaveAttribute("aria-selected", "true");
    // The bilingual fixtures are frozen, so the result view shows the expected
    // ground truth rather than the pending placeholder it used to.
    await expect(page.getByText("Frozen ground truth")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page input" })).toBeHidden();
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

    await expect(page.getByText(/Order #\d+ recorded exactly once from current catalog prices/)).toBeVisible();
    expect(submittedBody).toMatchObject({
      customer_id: "254711000001",
      items: [{ sku: "UNGA-2KG", qty: 2 }],
      paid: true,
    });
    expect((submittedBody as { event_id?: string }).event_id).toMatch(/^sale-[a-f0-9]{32}$/);
    const recordedOrder = page.getByRole("dialog", { name: "Order details" });
    await expect(recordedOrder).toContainText("Mama Achieng");
    await expect(recordedOrder).toContainText("Unga wa Dola 2kg");
    await expect(recordedOrder).toContainText(/2\s*×\s*Ksh\s*195/);
    await expect(recordedOrder).toContainText(/Total\s*Ksh\s*390/);
  });

  test("manual sale reuses one event ID after a lost response", async ({ page }) => {
    const attempts: Array<{ event_id: string }> = [];
    await page.route("**/api/orders", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      const payload = request.postDataJSON() as { event_id: string };
      attempts.push(payload);
      if (attempts.length === 1) {
        await route.fetch();
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated response loss after persistence" }),
        });
      }
      return route.continue();
    });

    await page.goto("/orders");
    await page.getByRole("button", { name: "Record sale" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a catalog-grounded sale" });
    await dialog.getByLabel("Customer").selectOption("254711000002");
    await dialog.getByLabel("Product").selectOption("SUKARI-1KG");
    await dialog.getByLabel("Quantity").fill("2");
    await dialog.getByRole("button", { name: "Record sale", exact: true }).click();

    await expect(dialog.getByRole("alert")).toContainText("The sale result could not be confirmed");
    await dialog.getByRole("button", { name: "Record sale", exact: true }).click();
    await expect(page.getByText(/recorded exactly once.*safe replay/)).toBeVisible();

    expect(attempts).toHaveLength(2);
    expect(attempts[1].event_id).toBe(attempts[0].event_id);
    const orders = await (await page.request.get("/api/orders")).json() as Array<{ source_event_id?: string }>;
    expect(orders.filter((order) => order.source_event_id === attempts[0].event_id)).toHaveLength(1);
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

  test("restock scan keeps a visible retry state after failure", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/restock/check", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated shelf scan outage" }),
        });
      }
      return route.continue();
    });

    await page.goto("/inventory");
    await page.getByRole("button", { name: "Run shelf scan" }).click();
    const failure = page.getByRole("alert").filter({ hasText: "The shelf scan did not complete" });
    await expect(failure).toContainText("The shelf scan did not complete");
    await expect(failure).toContainText("cannot create a second pending restock draft");
    await failure.getByRole("button", { name: "Retry scan" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(attempts).toBe(2);
  });

  test("decision conflict keeps the effect pending and refreshes the queue", async ({ page }) => {
    await page.route("**/api/approvals/*", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated conflicting decision" }),
        });
      }
      return route.continue();
    });

    await page.goto("/approvals");
    await page.getByRole("button", { name: "Reject draft" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reject draft" }).click();

    await expect(page.getByRole("status")).toContainText("Decision conflict");
    await expect(page.getByText("1 waiting decision")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Restock draft" })).toBeVisible();
  });

  test("decision resume failure stays retryable and completes the same rejection once", async ({ page }) => {
    const pendingResponse = await page.request.get("/api/approvals");
    const pending = await pendingResponse.json() as Array<Record<string, unknown>>;
    expect(pending).toHaveLength(1);
    let postAttempts = 0;

    await page.route("**/api/approvals**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && /\/api\/approvals\//.test(request.url())) {
        postAttempts += 1;
        if (postAttempts === 1) {
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            headers: { "x-request-id": "decision-retry-request" },
            body: JSON.stringify({ error: "Simulated resume interruption" }),
          });
        }
        return route.continue();
      }
      if (request.method() === "GET" && request.url().endsWith("/api/approvals") && postAttempts === 1) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pending.map((approval) => ({
            ...approval,
            status: "resume_failed",
            requested_decision: "rejected",
            resume_attempts: 1,
            retryable: true,
          }))),
        });
      }
      return route.continue();
    });

    await page.goto("/approvals");
    await page.getByRole("button", { name: "Reject draft" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reject draft" }).click();
    await expect(page.getByRole("status")).toContainText("same decision remains retryable");
    await expect(page.getByText(/previous rejected attempt did not complete/i)).toBeVisible();

    await page.getByRole("button", { name: "Reject draft" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reject draft" }).click();
    await expect(page.getByRole("status")).toContainText("Rejected exactly once");
    await expect(page.getByText("The queue is clear")).toBeVisible();
    expect(postAttempts).toBe(2);
  });

  test("owner approval applies the named draft once and replays idempotently", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: "Run shelf scan" }).click();
    await expect(page.getByRole("status")).toContainText("One owner-reviewed draft was created");

    await page.goto("/approvals");
    await page.getByRole("button", { name: "Accept draft" }).click();
    const confirmation = page.getByRole("alertdialog");
    const decisionResponse = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && response.url().includes("/api/approvals/")
    ));
    await confirmation.getByRole("button", { name: "Accept draft" }).click();
    const firstResponse = await decisionResponse;

    await expect(page.getByRole("status")).toContainText("Approved exactly once");
    await expect(page.getByText("The queue is clear")).toBeVisible();
    const replay = await page.request.post(firstResponse.url(), {
      data: { decision: "approved" },
      headers: { "content-type": "application/json" },
    });
    expect(replay.ok()).toBeTruthy();
    expect(await replay.json()).toMatchObject({ ok: true, idempotent: true, decision: "approved" });
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

  test("local night run keeps an explicit failure state before retry", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/recon/nightly?fuzzy=false", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated local run outage" }),
        });
      }
      return route.continue();
    });

    await page.goto("/night-shift");
    await page.getByRole("button", { name: "Run local exact check" }).click();
    const confirmation = page.getByRole("alertdialog");
    await confirmation.getByRole("button", { name: "Run exact pass" }).click();
    await expect(confirmation.getByRole("alert")).toContainText("result could not be confirmed");
    await confirmation.getByRole("button", { name: "Run exact pass" }).click();
    await expect(page.getByText("Local exact report persisted. This is not Scheduler proof.")).toBeVisible();
    expect(attempts).toBe(2);
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
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Handoff uncertain")).toBeVisible();
    const receipt = page.getByText(/queued .* · [a-f0-9]+/);
    const firstReceipt = await receipt.textContent();
    await page.getByRole("button", { name: "Retry same event ID" }).click();
    await expect(page.getByText("Accepted · waiting for worker")).toBeVisible();
    const retriedReceipt = await receipt.textContent();
    expect(retriedReceipt).toBe(firstReceipt);
    expect(attempts).toBe(2);
  });

  test("enter sends the message and shift+enter keeps a newline", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/api/inbound", async (route) => {
      const payload = route.request().postDataJSON() as { event_id: string; text: string };
      sent.push(payload.text);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ queued: true, event_id: payload.event_id }) });
    });

    await page.goto("/inbox");
    const composer = page.getByLabel("Message text");

    // Shift+Enter opens a second line instead of sending.
    await composer.fill("Niletee mkate");
    await composer.press("Shift+Enter");
    await composer.pressSequentially("na maziwa");
    expect(sent).toHaveLength(0);
    await expect(composer).toHaveValue("Niletee mkate\nna maziwa");

    // Enter sends the whole multi-line message and clears the composer. The
    // delivery mark is deliberately not asserted - the local worker replies
    // fast enough that the transient "accepted" label is a race.
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    expect(sent).toEqual(["Niletee mkate\nna maziwa"]);
  });

  test("session rotation reuses one operation after a lost response", async ({ page }) => {
    const attempts: Array<{ event_id: string; customer_id: string }> = [];
    await page.route("**/api/sessions/new", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      const payload = request.postDataJSON() as { event_id: string; customer_id: string };
      attempts.push(payload);
      if (attempts.length === 1) {
        await route.fetch();
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated response loss after rotation" }),
        });
      }
      return route.continue();
    });

    await page.goto("/inbox");
    // Session rotation now lives in the thread details drawer, so the thread
    // itself stays a conversation.
    await page.getByRole("button", { name: "Details" }).click();
    await page.getByRole("button", { name: "Start a new day" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a fresh managed session?" });
    await dialog.getByRole("button", { name: "Start new day" }).click();
    await expect(dialog.getByRole("alert")).toContainText("The new session could not be confirmed");
    await dialog.getByRole("button", { name: "Retry same session operation" }).click();
    await expect(page.getByText(/fresh managed session is active.*safe replay/i)).toBeVisible();

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0].event_id).toMatch(/^session-[a-f0-9]{32}$/);
  });

  test("execution receipt opens the exact authenticated order", async ({ page }) => {
    const ordersResponse = await page.request.get("/api/orders");
    expect(ordersResponse.ok()).toBeTruthy();
    const orders = await ordersResponse.json() as Array<{ id: string; status: string; total: number }>;
    const persistedOrder = { ...orders[0], id: String(orders[0]?.id ?? "") };
    expect(persistedOrder).toBeTruthy();
    await page.route("**/api/messages/*", (route) => {
      const customerId = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "synthetic-customer");
      return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "proof-message-1",
          customer_id: customerId,
          direction: "out",
          channel: "voice",
          text: "Your grounded order is ready.",
          created_at: "2026-08-27T09:00:00Z",
          meta: {
            event_id: "evt-order-proof-e2e",
            node_path: ["screen", "classifier", "router", "order_intake"],
            wall_ms: 842,
            cost_usd: 0.00042,
            tokens: { input: 140, output: 32 },
            order: { order_id: persistedOrder.id, status: persistedOrder.status, total: persistedOrder.total, needs_review: false },
          },
        },
      ]),
      });
    });

    await page.goto("/inbox");
    await page.getByText("Execution receipt").click();
    await expect(page.getByText(`Order #${persistedOrder.id} persisted`)).toBeVisible();
    await page.getByRole("link", { name: "Open order" }).click();
    await expect(page).toHaveURL(new RegExp(`/orders\\?order=${persistedOrder.id}$`));
    await expect(page.getByRole("dialog", { name: "Order details" })).toContainText(`Order #${persistedOrder.id}`);
  });

  test("catalog-grounded order follows its source event into the customer thread", async ({ page }) => {
    const [customersResponse, productsResponse] = await Promise.all([
      page.request.get("/api/customers"),
      page.request.get("/api/products"),
    ]);
    expect(customersResponse.ok()).toBeTruthy();
    expect(productsResponse.ok()).toBeTruthy();
    const customers = await customersResponse.json() as Array<{ id: string }>;
    const products = await productsResponse.json() as Array<{ sku: string }>;
    const customerId = customers[0]?.id;
    const sku = products[0]?.sku;
    expect(customerId).toBeTruthy();
    expect(sku).toBeTruthy();
    const eventId = "causal-order-proof-e2e";
    const createdResponse = await page.request.post("/api/orders", {
      data: { event_id: eventId, customer_id: customerId, items: [{ sku, qty: 1 }], paid: false },
    });
    expect(createdResponse.ok()).toBeTruthy();
    const created = await createdResponse.json() as { order_id: string };

    await page.goto(`/orders?order=${encodeURIComponent(String(created.order_id))}`);
    const dialog = page.getByRole("dialog", { name: "Order details" });
    await expect(dialog).toContainText(`Inbound event ${eventId}`);
    await dialog.getByRole("link", { name: "Open evidence" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/inbox\\?customer=${customerId}&event=${eventId}$`));
    await expect(page.getByText(`Following source event ${eventId} into this customer thread.`)).toBeVisible();
  });

  test("client authorization failure returns the owner to login", async ({ page }) => {
    await page.goto("/approvals");
    await page.route("**/api/approvals", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "owner session expired" }) }));
    await page.getByRole("button", { name: "Refresh queue" }).click();
    await expect(page).toHaveURL(/\/login\?next=\/approvals$/);
  });
});
