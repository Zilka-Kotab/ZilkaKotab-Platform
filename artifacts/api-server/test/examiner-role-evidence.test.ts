import assert from "node:assert/strict";
import { test } from "node:test";
import { findExaminerRole, parseExaminerRole, parseCorroboratedExaminerRole } from "../src/lib/examiner-role-evidence.ts";
import { discoverHistoricalGrants } from "../src/lib/examiner-history-discovery.ts";

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

test("omitted middle initials require corroboration and never merge conflicting initials", () => {
  const candidate = { applicationNumber: "11111111", grantDate: "2025-10-21", examinerName: "SUN, YULIN P" };
  assert.equal(parseCorroboratedExaminerRole(grant(), "SUN, YULIN P", "", candidate, true)?.role, "primary");
  assert.equal(parseCorroboratedExaminerRole(grant(), "SUN, YULIN P", "", candidate, false), null);
  assert.equal(parseCorroboratedExaminerRole(grant(), "SUN, YULIN P", "", { ...candidate, examinerName: "SUN, YULIN Q" }, true), null);
  assert.equal(parseCorroboratedExaminerRole(grant("Yulin Q"), "SUN, YULIN P", "", candidate, true), null);
  assert.equal(parseCorroboratedExaminerRole(grant("Y"), "SUN, YULIN P", "", candidate, true), null);
});

test("historical discovery checks the whole name family and rejects hidden additional initials", async () => {
  const record = (id: string, name: string, date = "2008-05-20") => ({
    applicationNumberText: id, applicationMetaData: { examinerNameText: name, grantDate: date },
  });
  let catalogPages = 0;
  const result = await discoverHistoricalGrants("SUN, YULIN P", async url => {
    if (url.searchParams.has("sort")) {
      assert.equal(url.searchParams.get("sort"), "applicationMetaData.grantDate asc");
      return Response.json({ count: 101, patentFileWrapperDataBag: [record("11111111", "SUN, YULIN P")] });
    }
    catalogPages++;
    const offset = Number(url.searchParams.get("offset"));
    return Response.json({ count: 101, patentFileWrapperDataBag: offset === 0
      ? Array.from({ length: 100 }, (_, i) => record(`${i}`, "SUN, YULIN P"))
      : [record("100", "SUN, YULIN P W")] });
  }, AbortSignal.timeout(1000));
  assert.equal(catalogPages, 2);
  assert.equal(result.omittedMiddleAllowed, false);
});

test("a separate historical search supplies a verified activity span and dated assistant/primary sequence", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async input => {
    const old = String(input).includes("old.xml");
    const xml = old ? grant("Yulin", "Alex", "20080520").replaceAll("primary-examiner", "assistant-examiner") : grant();
    return new Response(xml);
  }) as typeof fetch;
  const name = "SUN, YULIN P";
  const records = [
    { applicationNumberText: "11111111", applicationMetaData: { examinerNameText: name, grantDate: "2008-05-20" } },
    { applicationNumberText: "22222222", applicationMetaData: { examinerNameText: name, grantDate: "2025-10-21" } },
  ];
  let calls = 0;
  const getMetadata = async (url: URL) => {
    calls++;
    if (url.pathname.endsWith("/search")) return Response.json({ count: records.length, patentFileWrapperDataBag: records });
    return Response.json({ grantDocumentMetaData: { fileLocationURI: `https://data.uspto.gov/${url.pathname.includes("11111111") ? "old" : "new"}.xml` } });
  };
  try {
    const candidates = [{ applicationNumber: "22222222", grantDate: "2025-10-21", examinerName: name }];
    const result = await findExaminerRole(name, candidates, getMetadata, { discoverHistorical: true });
    assert.equal(result.role, "primary");
    assert.equal(result.earliestActivity?.issueDate, "2008-05-20");
    assert.equal(result.history?.coverageStatus, "historical");
    assert.equal(result.history?.confidence, "medium");
    assert.ok(result.history!.yearsObserved! > 17);
    assert.equal(result.history?.transitionStatus, "observed_sequence");
    assert.equal(result.history?.totalHistoricallyExamined, null);
    const before = calls;
    assert.deepEqual(await findExaminerRole(name, candidates, getMetadata, { discoverHistorical: true }), result);
    assert.equal(calls, before, "historical results are cached without repeating USPTO requests");
  } finally { globalThis.fetch = original; }
});

test("historical search failures cannot turn recent evidence into a short experience estimate", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(grant("Yulin P"))) as typeof fetch;
  try {
    const result = await findExaminerRole("SUN, YULIN P", [
      { applicationNumber: "33333333", grantDate: "2025-10-21", examinerName: "SUN, YULIN P" },
    ], async url => {
      if (url.pathname.endsWith("/search")) throw new Error("Unavailable");
      return Response.json({ grantDocumentMetaData: { fileLocationURI: "https://data.uspto.gov/recent.xml" } });
    }, { discoverHistorical: true });
    assert.equal(result.role, "primary");
    assert.equal(result.history?.yearsObserved, null);
    assert.match(result.history!.note, /Historical search failed/);
  } finally { globalThis.fetch = original; }
});
