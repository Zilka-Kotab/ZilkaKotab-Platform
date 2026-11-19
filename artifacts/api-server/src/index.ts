import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { scheduleFirmRefresh } from "./lib/firm-benchmark-store";
import { ensureInitialAdminAuthorization, ensurePatentMonitorTool } from "./lib/bootstrap";
import { ensureFirmOperationsSchema } from "./lib/firm-operations-schema";
import { ensureClerkSchema } from "./lib/clerk-schema";
import { warnIfAzureUnconfigured } from "./lib/ai/azure-client";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

pool.on("error", (err) => {
  logger.warn({ err }, "Idle PostgreSQL client disconnected");
});

async function start() {
  warnIfAzureUnconfigured();
  await ensureClerkSchema();
  await ensureFirmOperationsSchema();
  await ensureInitialAdminAuthorization();
  await ensurePatentMonitorTool();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    scheduleFirmRefresh();
  });
}

start().catch((err) => {
  logger.error({ err }, "Error during server startup");
  process.exit(1);
});
