import { pool } from "@workspace/db";
import { startFirmRefresh, firmRefreshStatus } from "./lib/firm-benchmark-store";
// Standalone entry point for a weekly scheduled deployment; no HTTP server required.
try {
  if (await startFirmRefresh()) {
    for (;;) {
      const status = await firmRefreshStatus();
      if (status.state !== "running") {
        console.log(JSON.stringify(status));
        if (status.state !== "ready") process.exitCode = 1;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } else {
    console.log("A firm dataset refresh is already running.");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : "Firm refresh failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
