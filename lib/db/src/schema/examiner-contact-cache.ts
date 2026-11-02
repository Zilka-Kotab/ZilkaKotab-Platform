import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Public evidence metadata only; downloaded documents and rendered pages are
// transient buffers, not database blobs or repository assets.
export const examinerContactCacheTable = pgTable("examiner_contact_cache", {
  identityKey: text("identity_key").primaryKey(),
  examinerName: text("examiner_name").notNull(),
  artUnit: text("art_unit"),
  result: jsonb("result").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
