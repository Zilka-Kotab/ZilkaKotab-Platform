import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePortfolioCounsel, COUNSEL_SEARCH_FIELDS } from "../src/lib/portfolio-counsel";

const record = (app: string, applicant: string, first: string, second = "", directory: string[] = []) => ({
  applicationNumberText: app, applicationMetaData: { firstApplicantName: applicant },
  correspondenceAddressBag: [{ nameLineOneText: first, nameLineTwoText: second }],
  recordAttorney: { attorneyBag: directory.map(name => ({ attorneyAddressBag: [{ nameLineOneText: name }] })) },
});
test("live Micron slash/client notation and dotted P.C. no longer discard Trask Britt", () => {
  const r = analyzePortfolioCounsel([record("1", "Micron Technology, Inc.", "TRASK BRITT, P.C./ MICRON TECHNOLOGY")], ["Micron Technology, Inc."]);
  assert.equal(r.available, true); assert.equal(r.label, "Top Outside Patent Counsel");
  assert.equal(r.entries[0].name, "TRASK BRITT, P.C."); assert.equal(r.entries[0].applicationCount, 1);
});
test("Ray Quinney client decoration is removed and matching nested attorney-address firm corroborates identity", () => {
  const r = analyzePortfolioCounsel([record("1", "Microsoft Technology Licensing, LLC", "Ray Quinney & Nebeker - Microsoft", "", [
    "MICROSOFT CORPORATION", "RAY QUINNEY & NEBEKER, P.C.", "PERKINS COIE LLP", "ARENT FOX LLP",
  ])], ["Microsoft Technology Licensing, LLC"]);
  assert.equal(r.label, "Top Outside Patent Counsel");
  assert.deepEqual(r.entries.map(e => e.name), ["Ray Quinney & Nebeker"]);
});
test("a separate client name line and in-house organizations are not outside firms", () => {
  const r = analyzePortfolioCounsel([
    record("1", "Microsoft Technology Licensing, LLC", "Newport IP, LLC", "Microsoft"),
    record("2", "Microsoft Technology Licensing, LLC", "MICROSOFT CORPORATION", "PATENT DEPARTMENT", ["PERKINS COIE LLP"]),
  ], ["Microsoft Technology Licensing, LLC"]);
  assert.deepEqual(r.entries.map(e => e.name), ["Newport IP, LLC"]);
  assert.equal(r.entries[0].portfolioSharePercent, 50);
});
test("IBM abbreviations/in-house contacts are excluded, and punctuation variants count distinct applications only", () => {
  const r = analyzePortfolioCounsel([
    record("1", "International Business Machines Corporation", "Harrity & Harrity, LLP", "IBM CORPORATION"),
    record("1", "International Business Machines Corporation", "HARRITY & HARRITY, L.L.P."),
    record("2", "International Business Machines Corporation", "HARRITY & HARRITY, L.L.P."),
    record("3", "International Business Machines Corporation", "IBM", "IBM IP LAW DEPARTMENT"),
  ], ["International Business Machines Corporation"]);
  assert.equal(r.entries.length, 1); assert.equal(r.entries[0].applicationCount, 2);
  assert.equal(r.sampleSize, 3); assert.equal(r.entries[0].portfolioSharePercent, 66.7);
});
test("nested customer-wide attorney organizations alone are never counted as case counsel", () => {
  const r = analyzePortfolioCounsel([{
    applicationNumberText: "1", applicationMetaData: { firstApplicantName: "Example Inc." },
    recordAttorney: { attorneyBag: [{ firstName: "Unrelated", lastName: "Lawyer", attorneyAddressBag: [{ nameLineOneText: "Unrelated Firm LLP" }] }] },
  }], ["Example Inc."]);
  assert.equal(r.available, false); assert.deepEqual(r.entries, []);
});
test("matching correspondence-customer fallback is used, but a different customer is not attributed", () => {
  const base = { applicationNumberText: "1", applicationMetaData: { firstApplicantName: "Example Inc.", customerNumber: 123 },
    recordAttorney: { customerNumberCorrespondenceData: { patronIdentifier: 123, powerOfAttorneyAddressBag: [{ nameLineOneText: "Summit Counsel PLLC" }] } } };
  assert.equal(analyzePortfolioCounsel([base], ["Example Inc."]).entries[0].name, "Summit Counsel PLLC");
  base.recordAttorney.customerNumberCorrespondenceData.patronIdentifier = 456;
  assert.equal(analyzePortfolioCounsel([base], ["Example Inc."]).available, false);
});
test("a name without verified firm status remains visible as a correspondence contact, not falsely unavailable or a verified law firm", () => {
  const r = analyzePortfolioCounsel([record("1", "Example Inc.", "Knobbe Martens")], ["Example Inc."]);
  assert.equal(r.available, true); assert.equal(r.label, "Top Counsel / Correspondence Contacts");
  assert.equal(r.entries[0].name, "Knobbe Martens"); assert.match(r.note, /not confirmed/);
});
test("hyphenated firm names are preserved and confirmed short names can match a legal-form directory expansion", () => {
  const r = analyzePortfolioCounsel([
    record("1", "Example Inc.", "Zilka-Kotab, P.C."),
    record("2", "Example Inc.", "Summit & Partners", "", ["Summit & Partners Law Offices PLLC"]),
    record("3", "Example Inc.", "Example & Partners"),
  ], ["Example Inc."]);
  assert.ok(r.entries.some(e => e.name === "Zilka-Kotab, P.C."));
  assert.ok(r.entries.some(e => e.name === "Summit & Partners"));
  // An applicant-branded contact is conservatively excluded rather than asserted outside counsel.
  assert.ok(!r.entries.some(e => e.name === "Example & Partners"));
});
test("parenthesized and unspaced hyphenated client tags merge into the same firm without damaging firm-name hyphens", () => {
  const r = analyzePortfolioCounsel([
    record("1", "Micron Technology, Inc.", "Greenberg Traurig, LLP (Micron)"),
    record("2", "Micron Technology, Inc.", "Greenberg Traurig, LLP"),
    record("3", "Micron Technology, Inc.", "Zilka-Kotab, P.C.-Micron"),
  ], ["Micron Technology, Inc."]);
  assert.equal(r.entries.find(e => e.name === "Greenberg Traurig, LLP")?.applicationCount, 2);
  assert.ok(r.entries.some(e => e.name === "Zilka-Kotab, P.C."));
});
test("an applicant's in-house mailing address does not turn its named employee or generic address lines into outside counsel", () => {
  const r = analyzePortfolioCounsel([
    record("1", "Microsoft Technology Licensing, LLC", "MICROSOFT CORPORATION", "Jane Doe"),
    record("2", "Microsoft Technology Licensing, LLC", "Suite 123", "Intellectual Property"),
  ], ["Microsoft Technology Licensing, LLC"]);
  assert.equal(r.available, false);
});
test("actual professional-service suffixes and client-routing abbreviations do not split a firm's counts", () => {
  const r = analyzePortfolioCounsel([
    record("1", "Micron Technology, Inc.", "Wells St. John, P.S."),
    record("2", "Micron Technology, Inc.", "Dorsey & Whitney LLP-IP Dept.-MTI"),
    record("3", "Micron Technology, Inc.", "Dorsey & Whitney LLP"),
    record("4", "Microsoft Technology Licensing, LLC", "Alleman Hall LLP/MS"),
  ], ["Micron Technology, Inc.", "Microsoft Technology Licensing, LLC"]);
  assert.equal(r.label, "Top Outside Patent Counsel");
  assert.equal(r.entries.find(e => e.name === "Dorsey & Whitney LLP")?.applicationCount, 2);
  assert.ok(r.entries.some(e => e.name === "Alleman Hall LLP"));
});
test("legacy application-specific practitioner records remain supported; actual source projections request the correct nested organizations", () => {
  const r = analyzePortfolioCounsel([{ applicationNumberText: "1", attorneyBag: [{ firstName: "Jane", lastName: "Doe" }] }], ["Example"]);
  assert.equal(r.label, "Top Attorneys of Record"); assert.equal(r.entries[0].name, "Jane Doe");
  assert.ok(COUNSEL_SEARCH_FIELDS.includes("recordAttorney.attorneyBag.attorneyAddressBag.nameLineOneText"));
  assert.ok(!COUNSEL_SEARCH_FIELDS.split(",").includes("recordAttorney"));
});
