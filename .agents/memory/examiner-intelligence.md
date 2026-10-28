---
name: Examiner intelligence scope
description: Product audience and evidence standards for the public USPTO examiner dashboard.
---

The public Patent Examiner Intelligence tool is for patent prosecution attorneys. Keep it free and public. Prefer transparent, reproducible statistics to broad but weakly supported metrics; never imply correlation proves a prosecution tactic causes allowance.

**Why:** The product brief identifies attorneys as the primary audience and explicitly prioritizes accuracy and data completeness over metric count.

**How to apply:** Show denominators, sample sizes, time periods, source coverage, and unavailable states. Do not infer a zero from missing event data or provide strategy recommendations when the sample is inadequate.

## Examiner experience evidence

The USPTO Red Book XML specification explicitly distinguishes primary and assistant examiners on a grant. This verifies the role on that dated document, not current GS grade or employment start date. The user approved documented role, with the supporting patent and issue date, instead of an unsupported GS grade. Never equate an application's filing date or current examiner assignment with the examiner's hire date.

**Why:** Official-source research found document-level role evidence, but did not establish an authoritative public per-examiner hire-date or GS-grade source. General promotion timelines do not verify an individual's experience.

**How to apply:** Any future role enrichment should identify a matching examiner and cite the grant and issue date. Label historical role evidence as such; keep tenure and GS grade unavailable unless independently verified. Source: https://www.uspto.gov/sites/default/files/documents/RedBookSpecification_V1_0.pdf, sections 1.56–1.58; associated grant XML metadata: https://data.uspto.gov/apis/patent-file-wrapper/associated-documents.

An experience proxy may be shown beside examiner role as a **documented activity span**, measured from dated records explicitly naming the examiner. Disclose that it covers the checked sample and is neither a hire date nor proof of continuous service.

**Why:** The user requested an experience measure based on earliest prosecution activity. Filing dates and unattributed office-action events can predate the examiner's involvement, so those dates alone cannot support the measure.

**How to apply:** Cite the earliest verified examiner-attributed document and its date, calculate elapsed time as of retrieval, and disclose incomplete historical coverage. Earlier signed office actions could improve this evidence; do not silently substitute unverified application/event dates.
