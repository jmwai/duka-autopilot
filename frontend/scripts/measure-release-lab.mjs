#!/usr/bin/env node

import { chromium } from "@playwright/test";

const baseUrl = (process.argv[2] ?? "http://127.0.0.1:18080").replace(/\/+$/, "");
const widths = [390, 768, 1280, 1440];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, interactionDurations: [] };
      window.__dukaReleaseLabMetrics = metrics;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.lcp = Math.max(metrics.lcp, entry.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) metrics.cls += entry.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes("event")) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId) metrics.interactionDurations.push(entry.duration);
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      }
    });

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Your shop is ready for the day." }).waitFor();
    const actionStarted = performance.now();
    await page.getByRole("button", { name: "Open owner menu" }).click();
    await page.keyboard.press("Escape");
    const actionCompleted = performance.now();
    await page.waitForTimeout(350);

    results.push(await page.evaluate(({ width, actionMs }) => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const metrics = window.__dukaReleaseLabMetrics;
      return {
        width_px: width,
        ttfb_ms: Math.round(navigation.responseStart * 100) / 100,
        lcp_ms: Math.round((metrics?.lcp ?? 0) * 100) / 100,
        cls: Math.round((metrics?.cls ?? 0) * 100000) / 100000,
        max_observed_event_ms: Math.max(0, ...(metrics?.interactionDurations ?? [])),
        observed_menu_action_ms: Math.round(actionMs * 100) / 100,
        horizontal_overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { width, actionMs: actionCompleted - actionStarted }));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  schema_version: 1,
  measured_at: new Date().toISOString(),
  source: "local paired production containers; not hosted field data",
  base_url: baseUrl,
  budgets: { ttfb_ms: 800, lcp_ms: 2500, cls: 0.1, interaction_ms: 200 },
  results,
}, null, 2));
