import { test } from "node:test";
import assert from "node:assert/strict";
import { applicantNameMatches, explicitOrganizationNames, uniqueCompanyNames, wikidataCompanyNames, chooseWikidataCompany, chooseGleifEntity, applicantScopeQuery, discoverCompanyNames } from "../src/lib/company-name-discovery";

const statement = (value: unknown) => ({ mainsnak: { datavalue: { value } } });
const company = { id: "Q380", labels: { en: { value: "Meta Platforms" } }, aliases: { en: [{ value: "Facebook" }, { value: "Big Blue" }] },
  claims: { P31: [statement({ id: "Q4830453" })], P1448: [statement({ text: "Meta Platforms, Inc." }), statement({ text: "Facebook, Inc." })] } };
test("official/former names are expanded without treating every nickname or product alias as a legal name", () => {
  assert.deepEqual(wikidataCompanyNames(company), ["Meta Platforms", "Meta Platforms, Inc.", "Facebook, Inc."]);
  assert.equal(chooseWikidataCompany([company], "Facebook"), company);
  assert.equal(chooseWikidataCompany([{ ...company, claims: {} }], "Facebook"), null);
});
test("ambiguous corporate identities and multiple matching LEIs are not merged automatically", () => {
  assert.equal(chooseWikidataCompany([company, { ...company, id: "Q999" }], "Facebook"), null);
  const entry = (id: string, name: string) => ({ id, attributes: { entity: { legalName: { name }, otherNames: [] } } });
  const a = entry("A", "Google LLC");
  assert.equal(chooseGleifEntity([a, entry("B", "Google Finance Ltd")], ["Google Inc."]), a);
  assert.equal(chooseGleifEntity([a, entry("B", "Google Inc.")], ["Google"]), null);
});
test("explicit DBA/FKA/AKA annotations expose both legal and operating names", () => {
  for (const separator of ["d/b/a", "d.b.a.", "DBA", "doing business as", "f/k/a", "formerly known as", "also known as"]) {
    assert.deepEqual(explicitOrganizationNames(`Old Entity, Inc. ${separator} New Brand LLC`), ["Old Entity, Inc.", "New Brand LLC"]);
    assert.equal(applicantNameMatches(`Old Entity, Inc. ${separator} New Brand LLC`, ["New Brand"]), true);
  }
});
test("IBM acronym, former names, and rare actual names remain matchable without matching unrelated brands", () => {
  assert.equal(applicantNameMatches("INTERNATIONAL BUSINESS MACHINES CORPORATION", ["IBM"]), true);
  assert.equal(applicantNameMatches("Facebook, Inc.", ["Meta Platforms", "Facebook"]), true);
  assert.equal(applicantNameMatches("Unrelated Research Corporation", ["Meta Platforms"]), false);
  assert.equal(applicantNameMatches("International Business Corporation", ["International Business Machines Corporation"]), false);
});
test("deduplication retains legally different Inc/LLC names and commas", () => {
  assert.deepEqual(uniqueCompanyNames([" Google Inc. ", "GOOGLE INC.", "Google LLC", "Example, Inc."]), ["GOOGLE INC.", "Google LLC", "Example, Inc."]);
});
test("native-script applicant names remain matchable without collapsing different names to empty keys", () => {
  assert.equal(applicantNameMatches("三星电子", ["三星电子"]), true);
  assert.equal(applicantNameMatches("其他公司", ["三星电子"]), false);
});
test("all selected names share one OR query, with quoted query operators remaining literals", () => {
  const names = Array.from({ length: 12 }, (_, i) => `Company Variant ${i}`);
  const query = applicantScopeQuery([...names, 'Example "quoted" \\ name']);
  for (const n of names) assert.ok(query.includes(`"${n}"`));
  assert.ok(query.includes('\\"quoted\\"')); assert.ok(query.includes("\\\\ name"));
});
test("provider failures remain explicit while user-provided aliases are searched", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("test unavailable"); };
  try {
    const data = await discoverCompanyNames("Offline Test Company", ["Former Name, Inc."]);
    assert.deepEqual(data.searchedNames, ["Offline Test Company", "Former Name, Inc."]);
    assert.equal(data.sources.length, 0);
    assert.ok(data.warnings.some(w => w.includes("unavailable")));
  } finally { globalThis.fetch = original; }
});
test("per-request additional names and audit mutations do not contaminate cached company identity", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes("wikidata") ? Response.json({ search: [] })
    : Response.json({ data: [], meta: { pagination: { total: 0 } } });
  try {
    const first = await discoverCompanyNames("Cache Isolation Test Company", ["Manual A, Inc."]);
    first.sources.push({ label: "Caller annotation", names: ["Manual A"], retrievedAt: "", url: "" });
    first.warnings.push("caller-specific warning");
    const second = await discoverCompanyNames("Cache Isolation Test Company", ["Manual B, LLC"]);
    assert.ok(!second.searchedNames.includes("Manual A, Inc."));
    assert.ok(second.searchedNames.includes("Manual B, LLC"));
    assert.equal(second.sources.length, 0);
    assert.ok(!second.warnings.includes("caller-specific warning"));
  } finally { globalThis.fetch = original; }
});
