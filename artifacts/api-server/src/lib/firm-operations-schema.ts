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
      ALTER TABLE firm_workflow_rows ADD COLUMN IF NOT EXISTS status text;
      ALTER TABLE firm_workflow_rows ADD COLUMN IF NOT EXISTS status_date date;
      ALTER TABLE firm_workflow_rows ADD COLUMN IF NOT EXISTS status_note text NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS firm_workflow_status_history (
        id serial PRIMARY KEY, public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        workflow_row_id integer NOT NULL REFERENCES firm_workflow_rows(id),
        status text NOT NULL, status_date date NOT NULL, note text NOT NULL DEFAULT '',
        actor_id integer REFERENCES portal_users(id), migration_key text UNIQUE,
        recorded_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS firm_status_history_row_idx ON firm_workflow_status_history(workflow_row_id, id);
      INSERT INTO firm_workflow_status_history(workflow_row_id,status,status_date,note,migration_key)
      SELECT r.id, v.stage, v.day, 'Preserved from the previous milestone tracker', r.id::text || ':' || v.stage
      FROM firm_workflow_rows r CROSS JOIN LATERAL (VALUES
        ('Strategy',r.strategy_sent_on),('Client Review',r.client_approval_sent_on),
        ('Ready to File',r.paralegal_sent_on),('Filed',r.filed_on)
      ) v(stage,day) WHERE r.status IS NULL AND v.day IS NOT NULL
      ON CONFLICT(migration_key) DO NOTHING;
      UPDATE firm_workflow_rows SET
        status = CASE WHEN filed_on IS NOT NULL THEN 'Filed'
          WHEN paralegal_sent_on IS NOT NULL THEN 'Ready to File'
          WHEN client_approval_sent_on IS NOT NULL THEN 'Client Review'
          WHEN strategy_sent_on IS NOT NULL THEN 'Strategy'
          WHEN assigned_to_id IS NOT NULL THEN 'Assigned' ELSE 'Unassigned' END,
        status_date = COALESCE(filed_on,paralegal_sent_on,client_approval_sent_on,strategy_sent_on),
        status_note = notes
      WHERE status IS NULL;
      ALTER TABLE firm_workflow_rows ALTER COLUMN status SET DEFAULT 'Unassigned';
      ALTER TABLE firm_workflow_rows ALTER COLUMN status SET NOT NULL;
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
