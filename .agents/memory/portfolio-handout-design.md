---
name: Patent intelligence handout design
description: Shared design and content boundaries for portfolio and examiner snapshot PDFs.
---

Portfolio and examiner downloads use a matching single-page, navy-and-gold snapshot format rather than unrelated report designs. Preserve the supplied lower section's heading, original icons, circular portrait, QR code, firm practice copy, and results footer exactly. Portfolio questions retain the supplied wording; examiner snapshots use the user's examiner-specific questions, reformulated where necessary to keep each on one line. Exact proportions take priority over the earlier approximate bottom-two-fifths allocation.

**Why:** The user corrected an approximation that omitted the questions/QR code and substituted letter badges for the original icons. They asked for the examiner PDF to mirror the portfolio design, then explicitly replaced its five questions with examiner-specific copy while permitting single-line reformulations.

**How to apply:** Fit dynamic analysis data and compact source/sample-size notes above the approved artwork, without stretching or rearranging it. Customize only the examiner question text; do not change portfolio questions or the firm artwork below them. Portfolio-specific strategic takeaways, event material, and outside-counsel rankings remain excluded from the PDF. Do not remove outside counsel from the webpage.

The handout's shared lower section must be rendered as native PDF text and vector artwork rather than a flattened screenshot. Keep the approved QR code and partner portrait unchanged as embedded image assets. Both tools' five question lines should be PDF text.

**Why:** The user found the required questions and footer copy visibly blurry in downloaded snapshots because the entire section had been inserted as a PNG. Keeping the original approved vector design preserves its appearance while making the text crisp at print size.

**How to apply:** When editing the PDF layouts, use the approved footer's vector content and native text. Do not re-rasterize the lower section or replace the original QR with a regenerated one; keep it identical to the approved handout.

Remove source-page company metrics and event text before cropping a reusable vector footer; clipping alone does not remove them from the PDF's text layer.

**Why:** A comparison export looked correctly scoped but text extraction also returned the original handout company's hidden header and counts. This can contaminate indexing, accessibility, and automated checks.

**How to apply:** Redact unwanted source content, not just its visible bounds. Verify exported text contains only the selected company's metrics while confirming the QR image remains byte-for-byte unchanged.

Keep essential PDF generation code and the approved footer available to an already-loaded app across publishes; do not require a late fetch of replaceable, hashed export assets.

**Why:** Both tools failed to export when an open tab referenced an older PDF-library chunk removed by a newer publish. The missing JavaScript URL returned the SPA's HTML with HTTP 200, so a successful HTTP status alone did not establish asset availability.

**How to apply:** Preserve the eager PDF dependency and bundled footer unless another explicit asset-retention strategy is provided. This trades some initial bundle size for reliable downloads without forcing a reload that would discard the user's analysis.

The standalone portfolio comparison tool exports one consolidated report for both companies, using the standard portfolio questions and approved footer. Include a side-by-side data table and comparison visuals. Show qualifying firm advantages separately for each company's matched cohort.

**Why:** The user replaced the earlier per-company PDF chooser with a consolidated comparison and specifically requested firm outperformance where supported against either or both companies.

**How to apply:** Do not restore the individual-company chooser for comparison exports. Keep missing metrics unavailable, retain metric-specific sample sizes, and never merge two differently technology-matched firm benchmarks into one universal firm rate.
