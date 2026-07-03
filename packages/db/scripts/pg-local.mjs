/**
 * Local embedded PostgreSQL for development — no Docker, no system install.
 * Downloads/uses a real Postgres binary and runs it as a child process with a
 * persistent data dir. Keeps running until you Ctrl-C (like `docker:up` but
 * foreground). Data survives restarts in packages/db/.pgdata.
 *
 * Credentials match .env.example DATABASE_URL:
 *   postgresql://moraqat:moraqat_dev_pw@localhost:5432/moraqat
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseDir = join(__dirname, "..", ".pgdata");

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "moraqat",
  password: "moraqat_dev_pw",
  port: 5432,
  authMethod: "scram-sha-256",
  // Force UTF8 so Arabic (نصوص عربية) stores correctly — Windows initdb
  // otherwise defaults the cluster to WIN1252.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  persistent: true,
  onLog: () => {}, // keep the terminal quiet; errors still surface below
  onError: (m) => console.error("[pg]", m),
});

async function main() {
  const initialised = existsSync(join(databaseDir, "PG_VERSION"));
  if (!initialised) {
    console.log("⛏  Initialising Postgres data dir (first run)…");
    await pg.initialise();
  }

  console.log("▶  Starting Postgres on localhost:5432…");
  await pg.start();

  // Ensure the app database exists (idempotent).
  try {
    await pg.createDatabase("moraqat");
    console.log("✓  Created database 'moraqat'.");
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already exists")) {
      console.log("✓  Database 'moraqat' already present.");
    } else {
      throw err;
    }
  }

  console.log("\n✅ Postgres is ready → postgresql://moraqat:***@localhost:5432/moraqat");
  console.log("   Leave this running. Press Ctrl-C to stop.\n");

  const shutdown = async () => {
    console.log("\n⏹  Stopping Postgres…");
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the event loop alive so the cluster stays up.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("❌ Failed to start embedded Postgres:", err);
  process.exit(1);
});
