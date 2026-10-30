---
name: Internal workflow data boundaries
description: Keep AppColl matter imports separate from firm-owned workflow and billing records.
---

AppColl is authoritative for docket and matter fields, and its task export is the primary source for the operations dashboard. Each row represents one AppColl task or deadline, not an entire patent matter. AppColl rows can identify a matter by AttorneyRef rather than numeric MatterID. Internal assignments, milestone dates, and billing data must remain separate and must never be overwritten or deleted by imports. Completing work places it into billing review, but does not mean invoiced or paid. The operations dashboard belongs in the existing authenticated portal and must not be exposed as a client-facing tool.

**Why:** The firm selected the existing portal for this internal operations tool, said the dashboard is primarily for viewing AppColl tasks, and specified that AppColl remains the official docket source, internal records are protected from imports, and substantive completion does not imply billing approval.

**How to apply:** Match MatterID or AttorneyRef when available; allow task-only CSV imports without a prerequisite matter-import screen. Keep source-owned versus firm-owned fields separate, enforce internal access server-side, and never delete internal progress when a source row is missing.

The workflow is a single spreadsheet-like interface with due date, assignee dropdown, strategy completed/sent, action sent for client approval, sent to paralegal for filing, and filed/completed dates. Management summaries belong above that sheet. Workflow is a global portal area, not a tool card. Notifications and preferences belong under Settings.

**Why:** The user explicitly rejected the separate internal work queue, matter-import, management and notification screens as too complex compared with their existing Excel process.

**How to apply:** Keep tracking, assigning and viewing progress together; use a simple Upload CSV entry point. Do not restore six-section navigation. Automatic AppColl email ingestion remains future work.
