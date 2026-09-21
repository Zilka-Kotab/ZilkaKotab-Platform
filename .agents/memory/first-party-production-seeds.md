---
name: First-party production seeds
description: How required built-in catalog records reach the independently provisioned production database.
---

Required first-party catalog records must be created by an idempotent application startup seed keyed by a database uniqueness constraint.

**Why:** Replit Publish applies schema changes but does not copy development table rows into production. Development-only tool records therefore leave the production catalog empty.

**How to apply:** Insert missing built-in records on API startup with conflict-safe semantics. Do not overwrite later administrator choices such as deactivating an existing tool.