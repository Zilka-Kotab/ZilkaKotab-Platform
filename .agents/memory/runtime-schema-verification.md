---
name: Runtime schema verification
description: A schema push can appear successful while a restarted workflow still sees an older database shape.
---

Verify the actual development database schema against the running service before treating a schema change as complete.

**Why:** A restart exposed a missing UUID column even though the schema tool had reported that changes were applied; checking the live connection clarified the migration state before proceeding.

**How to apply:** After schema changes, inspect the target database's information schema and confirm defaults, nullability, and unique indexes before restarting dependent workflows.