import { test } from "node:test";
import assert from "node:assert/strict";
import { usptoSearchBody } from "../src/lib/uspto-search-body";

test("long search POST body preserves every query term, page, fields, facets and sort", () => {
  const url = new URL("https://api.uspto.gov/api/v1/patent/applications/search");
  const query = Array.from({ length: 107 }, (_, i) => `applicationMetaData.firstApplicantName:"Company Variant ${i}"`).join(" OR ");
  url.searchParams.set("q", query); url.searchParams.set("limit", "100"); url.searchParams.set("offset", "200");
  url.searchParams.set("fields", "applicationNumberText,applicationMetaData,eventDataBag");
  url.searchParams.set("facets", "applicationMetaData.firstApplicantName,applicationMetaData.applicationStatusDescriptionText");
  url.searchParams.set("sort", "applicationMetaData.filingDate desc");
  assert.deepEqual(usptoSearchBody(url), {
    q: query, pagination: { limit: 100, offset: 200 },
    fields: ["applicationNumberText", "applicationMetaData", "eventDataBag"],
    facets: ["applicationMetaData.firstApplicantName", "applicationMetaData.applicationStatusDescriptionText"],
    sort: [{ field: "applicationMetaData.filingDate", order: "desc" }],
  });
});
test("unknown search options are rejected instead of silently losing query constraints", () => {
  assert.throws(() => usptoSearchBody(new URL("https://api.uspto.gov/api/v1/patent/applications/search?q=x&unsupported=y")));
});
