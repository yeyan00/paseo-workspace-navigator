import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 15_000,
  globalTimeout: 90_000,
  workers: 1,
  testDir: "tests/browser",
  use: { baseURL: "http://127.0.0.1:5178", trace: "retain-on-failure", video: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: "msedge",
        viewport: { width: 1280, height: 1000 },
      },
    },
    {
      name: "compact",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: "msedge" },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: !process.env.CI,
  },
});
