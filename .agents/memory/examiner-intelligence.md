---
name: Examiner intelligence scope
description: Product audience and evidence standards for the public USPTO examiner dashboard.
---

The public Patent Examiner Intelligence tool is for patent prosecution attorneys. Keep it free and public. Prefer transparent, reproducible statistics to broad but weakly supported metrics; never imply correlation proves a prosecution tactic causes allowance.

**Why:** The product brief identifies attorneys as the primary audience and explicitly prioritizes accuracy and data completeness over metric count.

**How to apply:** Show denominators, sample sizes, time periods, source coverage, and unavailable states. Do not infer a zero from missing event data or provide strategy recommendations when the sample is inadequate.

## Contact details and strategy scope

The user requests official USPTO examiner **phone only** at the top of results, followed by a **very succinct** AI Recommended Strategy. The example is illustrative, not fixed copy to reuse across examiners. Email retrieval and Office Action PDF/OCR contact scanning are no longer in scope; do not re-enable them without an explicit request.

**Why:** The user explicitly dropped examiner email retrieval to restore reliable, faster loading after the document/OCR lookup introduced long delays and stuck requests. The public directory supplies phone numbers without that work. Recommendations should remain actionable without implying that historical correlations establish causation or case-specific legal conclusions.

**How to apply:** Use verified directory identity matches, never constructed email addresses. Show explicit unavailable states. Keep the generated recommendation brief and conditional, use only supported metrics, and withhold it for inadequate samples. Do not imply the aggregate interview comparison establishes the optimal interview timing, or recommend Track One for an ineligible already-pending case. Do not include unresolved asynchronous RCE/continuation results as if they were final.

## Limited illustrative-metric exception

The user permits clearly labeled illustrative **Quarter-End Concentration** values when reliable live calculations are unavailable. This exception does NOT apply to the independent **RCE vs. Continuation Rate** card: each side must show a validated actual rate or **N/A**, never a sample fallback. Timing, action, restriction, and interview metrics also remain evidence-only.

**Why:** The later independent-rate instructions explicitly require N/A for incomplete or failed evidence, superseding the earlier combined Continuation/RCE mockup permission.

**How to apply:** Prefer valid live rates, including genuine zero. Calculate RCE and continuation independently on the same mature cohort; missing continuity cannot mean no continuation. Quarter-end calculations must use actual USPTO mailing dates, not internal action dates or applicant responses; the raw concentration is not business-day normalized.

## Independent-rate observation cohort

Use the same cohort of regular US non-provisional applications at least 24 calendar months old for RCE and continuation rates, including pending and disposed cases. Report the cutoff, exclusions, unresolved outcomes, and source dates. Withhold a rate if its eligible outcomes remain unresolved rather than silently dropping unknowns or treating them as negatives.

**Why:** Recent filings have had less opportunity to generate either event. The user requires comparable maturity filters, separate numerators, and explicit incomplete-data handling.

**How to apply:** Changing the cohort or event definition requires a calculation-version change and cache invalidation. A CON code alone does not establish a domestic continuation: real ODP records also use CON for PCT children, and child bags can include descendant links. Verify direct parent identity, domestic child identity, and the relationship type.

## Examiner experience evidence

The USPTO Red Book XML specification explicitly distinguishes primary and assistant examiners on a grant. This verifies the role on that dated document, not current GS grade or employment start date. The user approved documented role, with the supporting patent and issue date, instead of an unsupported GS grade. Never equate an application's filing date or current examiner assignment with the examiner's hire date.

**Why:** Official-source research found document-level role evidence, but did not establish an authoritative public per-examiner hire-date or GS-grade source. General promotion timelines do not verify an individual's experience.

**How to apply:** Any future role enrichment should identify a matching examiner and cite the grant and issue date. Label historical role evidence as such; keep tenure and GS grade unavailable unless independently verified. Source: https://www.uspto.gov/sites/default/files/documents/RedBookSpecification_V1_0.pdf, sections 1.56–1.58; associated grant XML metadata: https://data.uspto.gov/apis/patent-file-wrapper/associated-documents.

Use **Years of Observed Examination Activity**, never years employed. Withhold numeric years when historical coverage or identity resolution is inadequate; a handful of current-docket grants is not a career history, even with a sample disclaimer.

**Why:** A sparse grant lookup reported less than a year for an examiner the user identified as having 19 years of experience. Older public records omitted a middle initial, so strict name matching missed them. The user requires underlying evidence, confidence, historical coverage, and separation of assignment from actual examination.

**How to apply:** Cite dated examiner-attributed documents. Treat name variants as discovery candidates, not automatic identity merges; check duplicate names and reassignment. Distinguish observed assistant/primary records from a verified promotion date and sampled named-role counts from distinct applications actually examined over a career. Preserve missing-history states.

A corroborated historical activity span may be shown as a conservative **lower bound**, without requiring an exhaustive career history. Base it on the interval between verified older and newer dated examiner-role documents, not the interval from an application filing date to today. Clearly distinguish confidence in those attributed dates from confidence in complete career coverage.

**Why:** Requiring complete career-wide evidence for every numeric display made the requested Years of Activity metric permanently unavailable, even when substantially older examiner-named grants were verifiable. The user repeatedly requested an evidence-backed rough year count, not an employment-tenure estimate.

**How to apply:** Search independently for older grant candidates beyond the newest current-docket sample and verify the actual named role in grant XML. Omitted middle initials need canonical same-application corroboration and a name-family conflict check; do not simply drop initials or merge fuzzy names. Display the verified span conservatively (for example, `18+ years`) and cite the oldest dated document. Keep years unavailable if attribution fails or only a short recent sample is supported; do not infer career totals or a promotion date.

PatEx's examiner field describes assignment at the snapshot date for pending cases or at disposal for disposed cases. It cannot be joined to every earlier transaction as proof of that examiner's authorship.

**Why:** The official PatEx technical documentation explicitly describes snapshot/disposal assignment and notes that modern releases no longer provide numeric examiner IDs.

**How to apply:** Use PatEx to discover historical candidates, then corroborate dated activity and identity. A historical index is needed before career-wide metrics can be reliable. Documentation: https://www.uspto.gov/sites/default/files/documents/PatEx-2019-Technical-Doc.pdf.

RCE rate measures **filed requests**, not accepted requests. A verified request document marked “Not Entered” still establishes filing; administrative workflow markers alone do not. Continuation rate is independently the share of eligible parents with an expressly classified CON child, excluding DIV, CIP, provisional and foreign relationships.

**Why:** The user requires separate evidence-backed RCE and continuation percentages, and explicitly prohibits treating missing data or API failures as negatives. Unresolved workflow markers can otherwise keep the entire requested statistic unavailable.

**How to apply:** Preserve the common mature cohort and full denominator. Resolve ambiguous histories with complete document evidence rather than inventing negatives or silently switching to a resolved-only subset. Explain filing versus acceptance in the evidence notes and keep genuinely incomplete outcomes unknown.
