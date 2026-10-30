import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDate, parseFirmCsv, readFirmCsv } from "../src/lib/firm-operations-csv";

test("AppColl task CSV accepts native headers without a preceding matter import", () => {
  const result = readFirmCsv('\uFEFFTaskID,TaskType,Owner,Client,Matter,RespondBy,FinalDueDate,TaskStatus,ClosedOn,Comments\r\n123,Office action,A Attorney,Test Client,T-001,03/31/2026,04/30/2026,Open,,"Two lines\nand a comma, here"');
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0]?.externalId, "123");
  assert.equal(result.rows[0]?.matter, "T-001");
  assert.equal(result.rows[0]?.due, "2026-03-31");
  assert.equal(result.rows[0]?.raw.FinalDueDate, "04/30/2026");
  assert.equal(result.rows[0]?.description, "Two lines\nand a comma, here");
});
test("duplicate IDs, unknown mandatory columns and malformed records are rejected", () => {
  assert.ok(readFirmCsv("MatterID,Title\n1,Test").errors.length);
  assert.match(readFirmCsv("TaskID,Matter,TaskType\n1,X,Task\n1,Y,Other").errors.join(), /duplicate/);
  assert.match(readFirmCsv("TaskID,Matter,TaskType\n1,X,Task,extra").errors.join(), /cells/);
  assert.match(readFirmCsv("TaskID,Matter,TaskType,RespondBy\n1,X,Task,2026-02-30").errors.join(), /invalid/);
  assert.throws(() => parseFirmCsv('A,B\n"not closed,1'), /unclosed/);
});
test("calendar-only dates preserve dates and reject impossible dates", () => {
  assert.equal(calendarDate("02/29/2024"), "2024-02-29");
  assert.equal(calendarDate("2026-03-31T00:00:00Z"), "2026-03-31");
  assert.equal(calendarDate("2026-02-29"), null);
  assert.equal(calendarDate("13/01/2026"), null);
  assert.equal(calendarDate(""), null);
});
test("escaped quotes, CRLF and blank trailing rows parse correctly", () => {
  assert.deepEqual(parseFirmCsv('A,B\r\n"one ""quote""",two\r\n\r\n'), [["A", "B"], ['one "quote"', "two"]]);
});
