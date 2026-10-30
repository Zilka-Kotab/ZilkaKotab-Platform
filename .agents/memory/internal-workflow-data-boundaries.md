---
name: Internal workflow data boundaries
description: Keep AppColl matter imports separate from firm-owned workflow and billing records.
---

AppColl is authoritative for docket and matter fields, and its task export is the primary source for the operations dashboard. Each row represents one AppColl task or deadline, not an entire patent matter. AppColl rows can identify a matter by AttorneyRef rather than numeric MatterID. Internal assignments, milestone dates, and billing data must remain separate and must never be overwritten or deleted by imports. Completing work places it into billing review, but does not mean invoiced or paid. The operations dashboard belongs in the existing authenticated portal and must not be exposed as a client-facing tool.

**Why:** The firm selected the existing portal for this internal operations tool, said the dashboard is primarily for viewing AppColl tasks, and specified that AppColl remains the official docket source, internal records are protected from imports, and substantive completion does not imply billing approval.

**How to apply:** Match MatterID or AttorneyRef when available; allow task-only CSV imports without a prerequisite matter-import screen. Keep source-owned versus firm-owned fields separate, enforce internal access server-side, and never delete internal progress when a source row is missing.

Dashboard is the global staff area, with Workflow, Time & Billing and Settings as its tabs. Workflow is a single sheet with due date, assignee, current status, date reached and stage note. Management summaries belong above that sheet.

**Why:** The user explicitly rejected separate queues and multiple milestone/date columns as too complex. They want stages to be skipped, revisited and repeated, including separate Client Review rounds for strategy and final documents.

**How to apply:** Keep tracking, assigning and viewing progress together; use a simple Upload CSV entry point. Never enforce a one-way sequence or require every stage. Preserve each explicit status occurrence with its own reached date and note, including repeated identical statuses, in expandable history. Filed completes work; returning to an earlier status reopens it without deleting invoices or receipts. Preserve older milestone data rather than dropping it. Automatic AppColl email ingestion remains future work.

New assignees receive actual portal access through administrator-approved accounts, not assignment-only placeholders. Non-admin dashboards include only tasks they own/contribute to in AppColl, or are assigned to internally; sharing a client or matter alone does not qualify. Administrators retain the firm-wide assignment view.

**Why:** The user explicitly said new assignees have full portal access, but their dashboard should show only owner/contributor assignments from AppColl or internal dashboard assignments.

**How to apply:** Provision active users only through administrator controls, retaining Microsoft identity verification. Apply task-level assignment scope on the server to both rows and history. Resolve imported identities conservatively; ambiguous duplicate names must not grant task access.
