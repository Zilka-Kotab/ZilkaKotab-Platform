import assert from "node:assert/strict";
import { test } from "node:test";
import { findExaminerRole, parseExaminerRole } from "../src/lib/examiner-role-evidence.ts";

const grant = (primary = "Yulin", assistant = "Alex", date = "20251021") => `
<us-patent-grant>
<publication-reference><document-id><country>US</country><doc-number>12345678</doc-number><date>${date}</date></document-id></publication-reference>
<examiners><primary-examiner><last-name>Sun</last-name><first-name>${primary}</first-name><department>2485</department></primary-examiner>
<assistant-examiner><last-name>Smith</last-name><first-name>${assistant}</first-name></assistant-examiner></examiners>
</us-patent-grant>`;

test("grant role uses exact full name, actual patent number and issue date", () => {
  const evidence = parseExaminerRole(grant(), "SUN, YULIN", "https://example.com");
  assert.equal(evidence?.role, "primary");
  assert.equal(evidence?.patentNumber, "US12345678");
  assert.equal(evidence?.issueDate, "2025-10-21");
  assert.match(evidence!.note, /not a verified current role/);
  assert.equal(parseExaminerRole(grant(), "Alex Smith", "")?.role, "assistant");
});

test("initials, different first names, and unrelated names never verify identity", () => {
  for (const name of ["SUN, Y", "SUN, YULIA", "SMITH, A", "SUN", "Yulin Jones"]) {
    assert.equal(parseExaminerRole(grant(), name, ""), null);
  }
});

test("non-grants and missing or impossible publication dates cannot supply role evidence", () => {
  assert.equal(parseExaminerRole("<html>primary examiner Sun</html>", "SUN, YULIN", ""), null);
  assert.equal(parseExaminerRole(grant("Yulin", "Alex", "20250230"), "SUN, YULIN", ""), null);
  assert.equal(parseExaminerRole(grant("Yulin", "Alex", ""), "SUN, YULIN", ""), null);
});

test("lookup follows official redirect without disclosing a temporary document URL", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    requests.push(url);
    return url.includes("redirect")
      ? new Response(null, { status: 302, headers: { location: "https://data.uspto.gov/grant.xml?temporary=secret" } })
      : new Response(grant());
  }) as typeof fetch;
  try {
    const evidence = await findExaminerRole("SUN, YULIN", [{ applicationNumber: "12345678", grantDate: "2025-10-21" }],
      async () => Response.json({ patentFileWrapperDataBag: [{ grantDocumentMetaData: [{ fileLocationURI: "https://api.uspto.gov/redirect" }] }] }));
    assert.equal(evidence.role, "primary");
    assert.equal(requests.length, 2);
    assert.equal(evidence.sourceUrl, "https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12345678");
  } finally { globalThis.fetch = original; }
});

test("unavailable evidence stays unknown; candidate checks cover oldest and newest ends", async () => {
  const urls: string[] = [];
  const evidence = await findExaminerRole("SUN, YULIN", [1, 4, 2, 3].map(n => ({
    applicationNumber: `${n}`, grantDate: `2025-10-0${n}`,
  })), async (url) => { urls.push(url.pathname); return Response.json({}); });
  assert.equal(evidence.role, null);
  assert.deepEqual(urls.map(url => url.split("/").at(-2)), ["4", "1", "3", "2"]);
  assert.match(evidence.note, /does not establish/);
  const failure = await findExaminerRole("SUN, YULIN", [{ applicationNumber: "1", grantDate: "2025-10-01" }],
    async () => { throw new Error("upstream down"); });
  assert.match(failure.note, /lookup failed/);
});

test("earliest activity uses an exact-name grant issue date, while role uses the latest verified grant", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const old = String(input).includes("old");
    return new Response(grant("Yulin", "Alex", old ? "20111025" : "20251021"));
  }) as typeof fetch;
  try {
    const evidence = await findExaminerRole("SUN, YULIN", [
      { applicationNumber: "old", grantDate: "2011-10-25" },
      { applicationNumber: "new", grantDate: "2025-10-21" },
    ], async url => Response.json({
      grantDocumentMetaData: { fileLocationURI: `https://data.uspto.gov/${url.pathname.includes("/old/") ? "old" : "new"}.xml` },
    }));
    assert.equal(evidence.issueDate, "2025-10-21");
    assert.equal(evidence.earliestActivity?.issueDate, "2011-10-25");
    assert.match(evidence.earliestActivity!.note, /Not a hire date, continuous service/);
    assert.match(evidence.earliestActivity!.note, /2 checked/);
    assert.equal(evidence.history?.yearsObserved, null);
    assert.equal(evidence.history?.totalHistoricallyExamined, null);
    assert.equal(evidence.history?.confidence, "low");
    assert.equal(evidence.history?.transitionStatus, "not_established");
    assert.equal(evidence.history?.earliestPrimary?.issueDate, "2011-10-25");
    assert.equal(evidence.history?.evidence.length, 2);
  } finally { globalThis.fetch = original; }
});

test("verified history is reused without issuing the same USPTO requests again", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => new Response(grant())) as typeof fetch;
  try {
    const candidates = [{ applicationNumber: "98765432", grantDate: "2025-10-21" }];
    const getMetadata = async () => { calls++; return Response.json({
      grantDocumentMetaData: { fileLocationURI: "https://data.uspto.gov/cache-test.xml" },
    }); };
    const first = await findExaminerRole("SUN, YULIN", candidates, getMetadata);
    assert.equal(first.role, "primary");
    const second = await findExaminerRole("SUN, YULIN", candidates, getMetadata);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("untrusted document hosts are not fetched", async () => {
  const evidence = await findExaminerRole("SUN, YULIN", [{ applicationNumber: "1", grantDate: "2025-10-01" }],
    async () => Response.json({ grantDocumentMetaData: { fileLocationURI: "https://evil.test/grant.xml" } }));
  assert.equal(evidence.role, null);
  assert.match(evidence.note, /incomplete/);
});
