---
name: Portfolio metric evidence
description: Evidence and disclosure rules for public USPTO portfolio analytics.
---

For public portfolio intelligence, publish only metrics with traceable source fields. Disclose cohort size and date range for sample-based metrics. Counsel rankings may use structured USPTO attorney-address and correspondence-name fields when a record explicitly identifies a law firm; exclude generic corporate names and label practitioner-only results as attorneys of record. Do not infer continuation relationships without structured, validated family fields. Show “unavailable” rather than estimates when those fields are not supported.

**Why:** Unsupported inference can turn incomplete public records into misleading portfolio advice.

**How to apply:** Show denominators and filing-date ranges for prosecution samples. Count counsel by distinct application, disclose that listing does not prove who performed all work or a current engagement, and add family analytics only from validated relationship fields.

For the firm's technology-matched portfolio benchmark, the user specifically wants a firm comparison displayed **only when the firm meaningfully outperforms** the analyzed company. Do not add unfavorable or tied comparison messages, or imply that a correspondence customer number proves who performed all prosecution work.

**Why:** The positive-only display is a deliberate product rule; USPTO correspondence association alone is weaker evidence than a complete representation history.

**How to apply:** Keep each comparison tied to the same filing window, formulas, sufficient metric-specific samples, and transparent technology-center coverage. When discussing firm involvement, distinguish observed correspondence associations from proven historical work.

Do not describe prosecution statistics from the newest filings alone as portfolio-wide behavior. Recent filing cohorts disproportionately contain pending cases; the few already granted are unusually fast cases and may legitimately have no rejection events.

**Why:** Conditioning on grants within a recent-only filing cohort creates outcome-maturity bias. A zero within that subset need not be a parsing failure, but it is misleading as a general portfolio average. Missing or empty histories also do not prove zero actions.

**How to apply:** Spread capped portfolio samples across the returned result range, disclose that systematic block sampling is not random sampling, and preserve legitimate zero-action cases with actual history data. Exclude missing/empty histories from event-based denominators. Keep company and firm metric definitions synchronized and invalidate incompatible cached firm data when those definitions change.
