import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: {
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: "connected",
      testMatch: /connected.spec.js/,
      use: { baseURL: "http://127.0.0.1:5176" },
    },
    {
      name: "demo",
      testMatch: /demo.spec.js/,
      use: { baseURL: "http://127.0.0.1:5174" },
    },
    {
      name: "live",
      testMatch: /live.spec.js/,
      use: { baseURL: "http://127.0.0.1:5175" },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5176 --strictPort",
      url: "http://127.0.0.1:5176",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
      url: "http://127.0.0.1:5175",
      env: {
        VITE_SUPABASE_URL: "https://mvp-test.supabase.co",
        VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
      },
      reuseExistingServer: false,
    },
  ],
});
