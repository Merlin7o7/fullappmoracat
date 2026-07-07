/**
 * E2E runner: boots the built API (dist/main.js) against DATABASE_URL, waits
 * for /health, runs smoke.mjs, then tears the API down. Exit code = suite's.
 *
 * Prereqs: `pnpm db:build && pnpm --filter @moraqat/api build`, schema pushed,
 * seed applied. Used locally and by CI (with a postgres service container).
 */
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, "..");
const port = process.env.API_PORT ?? "4000";
const apiUrl = `http://localhost:${port}`;

// Throwaway RSA key so the suite exercises the CONFIGURED Google Wallet path
// (JWT issue + signature verify). Real deploys use the service-account key;
// without one the feature stays fail-closed.
const walletKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const walletPrivatePem = walletKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const walletPublicPem = walletKey.publicKey.export({ type: "spki", format: "pem" }).toString();

// Env values must be single-line: Windows `CreateProcess` truncates/drops
// multi-line environment variables, so a raw PEM (with real newlines) reaches
// the child empty and the wallet feature reports itself unconfigured. Encode
// newlines as literal "\n"; the wallet service un-escapes them, and smoke.mjs
// does the same for the public half. This makes the suite pass on Windows too.
const escapePem = (pem) => pem.replace(/\r?\n/g, "\\n");

const env = {
  ...process.env,
  API_PORT: port,
  WALLET_GOOGLE_ISSUER_ID: "3388000000099999999",
  WALLET_GOOGLE_SA_EMAIL: "e2e-wallet@moracat-e2e.iam.gserviceaccount.com",
  WALLET_GOOGLE_SA_KEY: escapePem(walletPrivatePem),
  // Public half for smoke.mjs to verify the signature (not read by the API).
  WALLET_GOOGLE_TEST_PUBLIC_KEY: escapePem(walletPublicPem),
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "e2e-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "e2e-refresh-secret",
  PAYMENTS_MODE: "mock",
  // Exercise the full commerce engine (checkout/subscriptions/webhooks) against
  // the mock provider. Real deploys keep COMMERCE_ENABLED=false (Community Mode);
  // this is the one place we validate the still-present engine end-to-end.
  COMMERCE_ENABLED: "true",
  MOCK_WEBHOOK_SECRET: process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

if (!env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

console.log("▶ starting API…");
const api = spawn(process.execPath, [join(apiDir, "dist", "main.js")], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
api.stderr.on("data", (d) => process.stderr.write(d));

async function waitForHealth(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${apiUrl}/health`);
      const body = await res.json();
      if (body.status === "ok" && body.db === "up") return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const healthy = await waitForHealth();
if (!healthy) {
  console.error("❌ API did not become healthy in time");
  api.kill();
  process.exit(1);
}
console.log("✓ API healthy — running smoke suite\n");

const suite = spawn(process.execPath, [join(__dirname, "smoke.mjs")], {
  env: { ...env, API_URL: apiUrl },
  stdio: "inherit",
});

const code = await new Promise((resolve) => suite.on("exit", resolve));
api.kill();
process.exit(code ?? 1);
