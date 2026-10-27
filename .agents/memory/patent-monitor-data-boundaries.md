---
name: Patent Monitor data boundaries
description: Durable confidentiality and provenance rules for Patent Infringement Monitor workspaces.
---

Patent Monitor analysis runs and review events are append-only records. Do not overwrite prior substantive output; create a new version or review event.

**Why:** The portal is the system of record, and clients and assigned attorneys must be able to determine what was generated, when, by which environment, and what was later reviewed.

**How to apply:** Enforce project access and data-classification visibility on the server. Clients must never receive attorney-work-product records. External provider adapters must explicitly select permitted inputs and must not gain general access to a Microsoft tenant or unrelated Microsoft 365 content.

## Monitoring defaults and prune designation

Every newly added asset is monitored by default. A patent remains monitored unless an authorized attorney or administrator explicitly pauses it; a PRUNE designation alone does not silently change its monitoring state.

**Why:** The user specified that monitoring should be opt-out, while prune is a portfolio decision that may need batch review before monitoring stops.

**How to apply:** Keep the database default for monitoring enabled. Treat recommendation designation and monitoring status as separate fields, and expose explicit bulk actions for each.

## Patent Monitor workspace scope

Keep the project workspace focused on the monitored patent portfolio and infringement-monitoring workflow. Generic classified-record entry and a standalone analysis-history section are not pertinent to this tool's workspace.

**Why:** The user clarified that these general collaboration records do not fit the Patent Monitor flow.

**How to apply:** Keep attorney-specific notes and patent-linked review details where they support patent decisions, but do not reintroduce the generic classified-record/review-history workspace section without a new request.

## Monitoring status presentation

Show monitored and paused state with row color accents that match the Monitoring and Paused filters, rather than repeating a status badge in every portfolio row.

**Why:** The user prefers the row tint to carry the status and free horizontal space for patent details.

**How to apply:** Keep the row accent and filter colors consistent, retain text controls for changing state in expanded details/actions, and include the status in accessible row labels.

## Patent portfolio removal

Do not use archive controls as the portfolio cleanup flow. Keep legacy archived records accessible in the attorney/admin list, and use a confirmed bulk delete for permanent removal; preserve historical analysis runs detached from deleted patents.

**Why:** The user asked to remove the archive control and manage unneeded portfolio records through explicit deletion instead.

**How to apply:** Batch selection should support monitoring-state changes and permanent deletion. Explain that claims and attorney notes are removed while analysis provenance remains, and require confirmation before deleting.