---
name: PostgreSQL pool termination
description: Handling idle PostgreSQL connection termination events during deployment transitions.
---

An administrator-initiated PostgreSQL termination of an idle connection can surface through `pg.Pool`'s `error` event. Without a listener, Node can treat it as unhandled and exit, failing API promotion after compilation and health checks have succeeded.

**Why:** A Replit Autoscale publish compiled both artifacts, started the API, and returned 200 from `/api/healthz`; PostgreSQL then terminated an idle connection and the API process crashed during promotion.

**How to apply:** API processes using `pg.Pool` should register an error listener before startup database queries. Log non-sensitive error details and let the pool remove the dead client; do not mask the issue by changing schema or deployment settings.