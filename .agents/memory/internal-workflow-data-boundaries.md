---
name: Internal workflow data boundaries
description: Keep AppColl matter imports separate from firm-owned workflow and billing records.
---

AppColl is authoritative for docket and matter fields, and its task export is the primary source for the operations dashboard's task queue. AppColl task rows can identify a matter by AttorneyRef rather than numeric MatterID. Internal assignments, timekeeping, and billing data must remain separate and must never be overwritten or deleted by matter imports. Completing work must not approve its billing; billing approval and export are separate steps. The operations dashboard belongs in the existing authenticated portal and must not be exposed as a client-facing tool.

**Why:** The firm selected the existing portal for this internal operations tool, said the dashboard is primarily for viewing AppColl tasks, and specified that AppColl remains the official docket source, internal records are protected from imports, and substantive completion does not imply billing approval.

**How to apply:** When importing tasks, link either AppColl MatterID or AttorneyRef to the already-imported matter. Keep the task queue primary while preserving source-owned versus firm-owned fields, enforce internal access server-side, keep task completion separate from billing review/export, and treat missing matters as reportable rather than deletable.
