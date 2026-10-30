import { pool } from "@workspace/db";

/** Additive migration: preserve authorization records and all existing references. */
export async function ensureClerkSchema() {
  await pool.query(`
    ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS clerk_user_id varchar;
    ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS clerk_invitation_sent_at timestamptz;
    CREATE UNIQUE INDEX IF NOT EXISTS portal_users_clerk_user_unique ON portal_users (clerk_user_id);
  `);
}
