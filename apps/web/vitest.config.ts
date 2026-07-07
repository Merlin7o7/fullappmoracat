import { defineConfig } from "vitest/config";

// Unit tests for pure library logic (no DOM). Kept narrow on purpose — only
// files matching lib/**/*.test.ts run, so component/integration coverage stays
// the job of the e2e harness.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
