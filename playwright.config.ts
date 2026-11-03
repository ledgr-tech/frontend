import { defineConfig } from "@playwright/test";

// Os fluxos de ponta a ponta (e2e/), contra o backend de mentira. Local, reaproveita o `npm run dev`
// e o fake já de pé; no CI sobe os dois, com o app do `npm run build`.
const CI = !!process.env.CI;
const URL_DO_APP = process.env.E2E_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: CI ? 1 : 0,
  reporter: CI ? "github" : "list",
  use: {
    baseURL: URL_DO_APP,
    // local usa o Chrome instalado, sem baixar navegador; o CI instala o Chromium do Playwright
    channel: CI ? undefined : "chrome",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "node scripts/backend-fake.mjs", url: "http://localhost:8000/health", reuseExistingServer: !CI },
    {
      command: CI ? "npm run start" : "npm run dev",
      url: URL_DO_APP + "/login",
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        LEDGR_API_URL: "http://localhost:8000",
        // o fake não confere a assinatura do token: qualquer segredo serve
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "segredo-so-do-e2e",
        AUTH_TRUST_HOST: "true",
      },
    },
  ],
});
