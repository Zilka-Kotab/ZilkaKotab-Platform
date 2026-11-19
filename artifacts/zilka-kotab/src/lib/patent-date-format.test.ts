import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPatentDate } from "./patent-date-format";

test("date-only patent values keep their calendar day in Pacific time", () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(new Date("2014-12-11").toLocaleDateString("en-US"), "12/10/2014");
    assert.equal(formatPatentDate("2014-12-11", "en-US"), "Dec 11, 2014");
    assert.equal(formatPatentDate("2016-08-02", "en-US"), "Aug 2, 2016");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

test("timestamps retain local date formatting", () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(formatPatentDate("2014-12-11T00:00:00.000Z", "en-US"), "Dec 10, 2014");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});
