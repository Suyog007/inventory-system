// Long-running outbox worker.
// Run with: npm run worker
//
// Polls every POLL_INTERVAL_MS for pending OutboxItems and processes them.
// Exits cleanly on SIGINT/SIGTERM.

import "dotenv/config";
import { processNextBatch } from "@/lib/sync/outbox";

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

let shuttingDown = false;

async function main() {
  console.log("[outbox-worker] started; polling every", POLL_INTERVAL_MS, "ms");
  while (!shuttingDown) {
    try {
      const n = await processNextBatch(BATCH_SIZE);
      if (n > 0) {
        console.log(`[outbox-worker] processed ${n} item(s)`);
      }
    } catch (err) {
      console.error("[outbox-worker] batch error:", err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  console.log("[outbox-worker] shutting down");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[outbox-worker] received ${sig}`);
    shuttingDown = true;
  });
}

main().catch((err) => {
  console.error("[outbox-worker] fatal:", err);
  process.exit(1);
});
