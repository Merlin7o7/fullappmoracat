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
  // Distinct key material for vet counter-mode PIN tokens — signing those with
  // the access secret would make a 4-digit PIN mint a full member access token.
  JWT_COUNTER_SECRET: process.env.JWT_COUNTER_SECRET ?? "e2e-counter-secret",
  PAYMENTS_MODE: "mock",
  // Exercise the full commerce engine (checkout/subscriptions/webhooks) against
  // the mock provider. Real deploys keep COMMERCE_ENABLED=false (Community Mode);
  // this is the one place we validate the still-present engine end-to-end.
  COMMERCE_ENABLED: "true",
  MOCK_WEBHOOK_SECRET: process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret",
  // The suites drive several hundred requests from one IP in a few seconds and
  // would otherwise trip the 120/min limiter — which produced 429s that looked
  // exactly like real assertion failures. Raised here only; production keeps
  // the default (see app.module.ts).
  THROTTLE_LIMIT: "100000",
  // The census-integrity limiters (per-route cat-creation throttle + per-account
  // daily cap) are likewise relaxed for the suite, which registers many cats on
  // one account in seconds. Production keeps the safe defaults (4/min, 8/day).
  CENSUS_CREATE_THROTTLE: "100000",
  CENSUS_MAX_CATS_PER_DAY: "100000",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

if (!env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      const body = await res.json();
      if (body.status === "ok" && body.db === "up") return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Boot the built API with a given env, run one suite against it, tear it down.
 * Returns the suite's exit code.
 */
/**
 * Refuse to run against a port someone else is already holding.
 *
 * A previous run whose API survived teardown (Windows `child.kill()` does not
 * always take) leaves a listener behind. The next run's API then dies with
 * EADDRINUSE while the suite happily talks to the *stale* process — so the
 * tests silently grade an old build, and the failures that surface look like
 * unrelated product bugs. Cost me an hour; it should cost the next person none.
 */
async function assertPortFree(port) {
  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      console.error(
        `❌ Something is already listening on :${port} and answering /health.\n` +
          `   That is almost certainly a leftover API from an earlier run.\n` +
          `   Kill it first — the suite would otherwise test THAT process, not this build.`
      );
      return false;
    }
  } catch {
    /* Nothing listening (or not an API) — good. */
  }
  return true;
}

/**
 * Stop the API and *verify* it actually stopped.
 *
 * `child.kill()` is a request, not a guarantee — on Windows it frequently
 * leaves the node process alive. An orphan here poisons every later run (see
 * assertPortFree), so we escalate to a hard kill and only return once the port
 * is genuinely free.
 */
async function stopApi(api, port) {
  api.kill();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    let listening = false;
    try {
      await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(400) });
      listening = true;
    } catch {
      /* gone */
    }
    if (!listening) return;
    // Still up after the polite request — escalate.
    if (i === 4) {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(api.pid), "/f", "/t"], { stdio: "ignore" });
        } else {
          api.kill("SIGKILL");
        }
      } catch {
        /* best effort */
      }
    }
  }
  console.error(`⚠ API on :${port} did not shut down — kill it before the next run.`);
}

async function runSuite({ label, suiteFile, port, extraEnv }) {
  const url = `http://localhost:${port}`;
  const childEnv = { ...env, ...extraEnv, API_PORT: String(port) };

  if (!(await assertPortFree(port))) return 1;

  console.log(`\n▶ ${label} — starting API on :${port}…`);
  const api = spawn(process.execPath, [join(apiDir, "dist", "main.js")], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stderr.on("data", (d) => process.stderr.write(d));
  // stdout MUST be consumed. A piped-but-unread stdout fills its 64KB OS buffer
  // and then blocks the API mid-write — a deadlock that surfaces as random,
  // unrelated-looking assertion failures much later in the suite.
  api.stdout.on("data", (d) => { if (process.env.E2E_API_LOGS === "1") process.stdout.write(d); });

  if (!(await waitForHealth(url))) {
    console.error(`❌ API did not become healthy in time (${label})`);
    api.kill();
    return 1;
  }
  console.log(`✓ API healthy — running ${suiteFile}\n`);

  const suite = spawn(process.execPath, [join(__dirname, suiteFile)], {
    env: { ...childEnv, API_URL: url },
    stdio: "inherit",
  });
  const code = await new Promise((resolve) => suite.on("exit", resolve));
  await stopApi(api, port);
  // Let the port free before the next boot — Windows holds it briefly.
  await new Promise((r) => setTimeout(r, 1000));
  return code ?? 1;
}

// Pass 1 — commerce ON. Exercises the full, still-present payment engine
// against the mock provider. This is the only place that engine is validated.
const smokeCode = await runSuite({
  label: "commerce ON (full engine)",
  suiteFile: "smoke.mjs",
  port: Number(port),
  extraEnv: { COMMERCE_ENABLED: "true" },
});

// Pass 2 — commerce OFF. Proves the Community-Mode kill-switch actually holds:
// no price, checkout, payment or activation is reachable, while the census and
// the free Cat ID still are. Pass 1 cannot prove this, because it runs with the
// switch on by design.
const killSwitchCode = await runSuite({
  label: "commerce OFF (Community Mode kill-switch)",
  suiteFile: "commerce-off.mjs",
  port: Number(port) + 100,
  extraEnv: { COMMERCE_ENABLED: "false" },
});

const code = smokeCode || killSwitchCode;
console.log(
  code === 0
    ? "\n✅ ALL SUITES PASSED (commerce on + commerce off)"
    : "\n❌ SUITE FAILURES — see above"
);
process.exit(code);
