---
name: Internal workflow data boundaries
description: Keep AppColl matter imports separate from firm-owned workflow and billing records.
---

AppColl is authoritative for docket and matter fields. Internal assignments, timekeeping, and billing data must remain separate and must never be overwritten or deleted by matter imports. The operations dashboard belongs in the existing authenticated portal and must not be exposed as a client-facing tool.

**Why:** The firm selected the existing portal for this internal operations tool and specified that AppColl remains the official docket source while internal records are protected from imports.

**How to apply:** When expanding the operations dashboard, preserve source-owned versus firm-owned fields, enforce internal access server-side, and treat missing matters as reportable rather than deletable.
