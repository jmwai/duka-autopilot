import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const e2ePython = resolve("../.venv/bin/python");

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "judge-state.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: process.env.CI ? "chromium" : "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `${e2ePython} scripts/start-e2e-backend.py`,
      url: "http://127.0.0.1:8100/health",
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: "node scripts/start-e2e-frontend.mjs",
      url: "http://127.0.0.1:3100/health",
      timeout: 90_000,
      reuseExistingServer: false,
      env: {
        DUKA_API_URL: "http://127.0.0.1:8100",
        DUKA_ENV: "local",
        NEXT_DEPLOYMENT_ID: "playwright-local",
        RELEASE_SHA: "playwright-local",
        HOSTNAME: "127.0.0.1",
        PORT: "3100",
      },
    },
  ],
});
