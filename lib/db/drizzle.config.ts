import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // These tables are created at runtime by examiner-rce-store.ts, not managed by Drizzle.
  tablesFilter: ["*", "!examiner_application_evidence", "!examiner_rate_jobs"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
