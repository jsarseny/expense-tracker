import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5180",
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "npm run dev -w @tracker/api",
          url: "http://127.0.0.1:3100/api/health/ready",
          reuseExistingServer: false,
          env: {
            PORT: "3100",
            METRICS_PORT: "3101",
            APP_ORIGIN: "http://localhost:5180",
          },
        },
        {
          command: "npm run dev -w @tracker/web -- --port 5180",
          url: "http://localhost:5180",
          reuseExistingServer: false,
          env: { API_PROXY_TARGET: "http://127.0.0.1:3100" },
        },
      ],
  timeout: 45000,
});
