import { pool } from "@workspace/db";

/** Additive and repeatable: never rename/drop the earlier workflow or time records. */
export async function ensureFirmOperationsSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7318041)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS firm_workflow_rows (
        id serial PRIMARY KEY, public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        source_key text NOT NULL UNIQUE,
        docket_task_id integer REFERENCES internal_workflow_docket_tasks(id),
        internal_task_id integer REFERENCES internal_workflow_tasks(id),
        assigned_to_id integer REFERENCES portal_users(id),
        strategy_sent_on date, client_approval_sent_on date, paralegal_sent_on date, filed_on date,
        notes text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS firm_billing_items (
        id serial PRIMARY KEY, public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        workflow_row_id integer REFERENCES firm_workflow_rows(id),
        owner_id integer NOT NULL REFERENCES portal_users(id),
        kind text NOT NULL DEFAULT 'FEE', work_date date NOT NULL, prebilled_on date,
        client text NOT NULL DEFAULT '', matter text NOT NULL DEFAULT '', description text NOT NULL,
        amount_cents integer NOT NULL DEFAULT 0, notes text NOT NULL DEFAULT '',
        code text NOT NULL DEFAULT '', jurisdiction text NOT NULL DEFAULT '',
        subject_matter text NOT NULL DEFAULT '', associate text NOT NULL DEFAULT '',
        share_basis_points integer NOT NULL DEFAULT 10000,
        invoice_number text NOT NULL DEFAULT '', invoice_date date,
        voided boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE firm_billing_items ADD COLUMN IF NOT EXISTS prebilled_on date;
      CREATE UNIQUE INDEX IF NOT EXISTS firm_billing_workflow_unique ON firm_billing_items(workflow_row_id);
      CREATE TABLE IF NOT EXISTS firm_payments (
        id serial PRIMARY KEY, public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        billing_item_id integer NOT NULL REFERENCES firm_billing_items(id),
        amount_cents integer NOT NULL, received_on date NOT NULL,
        reference text NOT NULL DEFAULT '', request_id uuid NOT NULL UNIQUE,
        created_by_id integer NOT NULL REFERENCES portal_users(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally { client.release(); }
}
