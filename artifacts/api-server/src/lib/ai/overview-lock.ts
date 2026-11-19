import { createHash } from "node:crypto";
import { pool } from "@workspace/db";

export async function withPatentOverviewLock<T>(
  patentId: number,
  claimVersions: Array<{ id: number; claimNumber: string; version: number; selectedForMonitoring: boolean }>,
  operation: () => Promise<T>,
): Promise<T> {
  const snapshot = [...claimVersions]
    .sort((a, b) => a.claimNumber.localeCompare(b.claimNumber))
    .map(({ id, claimNumber, version, selectedForMonitoring }) => [id, claimNumber, version, selectedForMonitoring]);
  const lockKey = createHash("sha256")
    .update(JSON.stringify([patentId, snapshot]))
    .digest()
    .readBigInt64BE(0)
    .toString();
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [lockKey]);
    locked = true;
    return await operation();
  } finally {
    try {
      if (locked) await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
    } finally {
      client.release();
    }
  }
}
