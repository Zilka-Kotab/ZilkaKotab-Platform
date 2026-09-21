---
name: Patent Monitor data boundaries
description: Durable confidentiality and provenance rules for Patent Infringement Monitor workspaces.
---

Patent Monitor analysis runs and review events are append-only records. Do not overwrite prior substantive output; create a new version or review event.

**Why:** The portal is the system of record, and clients and assigned attorneys must be able to determine what was generated, when, by which environment, and what was later reviewed.

**How to apply:** Enforce project access and data-classification visibility on the server. Clients must never receive attorney-work-product records. External provider adapters must explicitly select permitted inputs and must not gain general access to a Microsoft tenant or unrelated Microsoft 365 content.