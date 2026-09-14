import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests.
 *
 * Run with:
 *   BASE_URL=http://localhost:8080 bunx playwright test
 *
 * The dev server is expected to already be running on BASE_URL.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8080",
    viewport: { width: 390, height: 844 }, // mobile-first
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : undefined,
      },
    },
  ],
});
