import { test } from "node:test";
import assert from "node:assert/strict";
import { extractExaminerContact, nameInContact, emailCorroboratesName } from "../src/lib/examiner-contact-extraction";
import { downloadUsptoDocument } from "../src/lib/public-patent-tools";

const name = "DOE, JANE P";
const paragraph = "Any inquiry concerning this communication should be directed to JANE P DOE whose telephone number is (571) 555-1234. Examiner email: jane.doe@uspto.gov. ";

test("extracts printed contacts from the named examiner's paragraph, excluding supervisor", () => {
  const hits = extractExaminerContact(paragraph + "If attempts to reach the examiner fail, the supervisor John Smith can be reached at john.smith@uspto.gov or (571) 555-9999.", name);
  assert.ok(hits.some((h) => h.email === "jane.doe@uspto.gov" && h.phone === "(571) 555-1234"));
  assert.ok(hits.every((h) => h.email !== "john.smith@uspto.gov" && h.phone !== "(571) 555-9999"));
});
test("does not use mere current assignment, other examiners, help desks, or guessed emails", () => {
  assert.deepEqual(extractExaminerContact(paragraph, "SMITH, JOHN"), []);
  const wrongAuthor = "Any inquiry should be directed to JOHN SMITH whose telephone number is (571) 555-9999. Email john.smith@uspto.gov.\n\nJANE P DOE\nPrimary Patent Examiner";
  assert.deepEqual(extractExaminerContact(wrongAuthor, name), []);
  assert.deepEqual(extractExaminerContact("Help desk: ebc@uspto.gov. JANE P DOE, Patent Examiner.", name), []);
  assert.ok(extractExaminerContact(paragraph.replace("Examiner email: jane.doe@uspto.gov.", ""), name).every((h) => h.email === null));
});
test("rejects conflicting addresses within one block and non-USPTO email", () => {
  const hits = extractExaminerContact(paragraph + "Alternate jane.other@uspto.gov.", name);
  assert.ok(hits.every((h) => h.email === null));
  assert.ok(extractExaminerContact(paragraph.replace("@uspto.gov", "@example.com"), name).every((h) => h.email === null));
});
test("supports document punctuation and conservative middle-initial checks", () => {
  assert.equal(nameInContact("Jane P. Doe", name), true);
  assert.equal(nameInContact("Jane X Doe", name), false);
  assert.equal(nameInContact("J P Doe", name), false);
  assert.equal(extractExaminerContact(paragraph.replace("@uspto.gov", " @ uspto . gov"), name)[0]?.email, "jane.doe@uspto.gov");
});
test("rejects external document URLs before any authenticated request", async () => {
  await assert.rejects(downloadUsptoDocument("https://example.com/document.pdf", AbortSignal.timeout(1000)), /Invalid ODP/);
  await assert.rejects(downloadUsptoDocument("https://api.uspto.gov/other/document.pdf", AbortSignal.timeout(1000)), /Invalid ODP/);
});
test("does not accept OCR surname substitutions as verified addresses", () => {
  assert.equal(emailCorroboratesName("jane.doe@uspto.gov", name), true);
  assert.equal(emailCorroboratesName("jane.d0e@uspto.gov", name), false);
  assert.equal(emailCorroboratesName("john.smith@uspto.gov", name), false);
});
