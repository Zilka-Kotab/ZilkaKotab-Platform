import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicExaminerAnalysis } from "@workspace/api-client-react";
import { ExaminerGuidance } from "./ExaminerGuidance";

const fixture = {
  searchType: "examiner", examinerName: "Synthetic Example",
  examinerContact: { status: "matched", phone: "(571) 555-1234", email: "never-display@uspto.gov",
    verificationMethod: "directory", confidence: "moderate", checkedAt: "2026-11-02T00:00:00Z", note: "Directory listing" },
  recommendedStrategy: { status: "ready", summary: "Synthetic strategy", approach: "Review → discuss", note: "Synthetic evidence" },
} as unknown as PublicExaminerAnalysis;

test("contact section displays phone and strategy, not an email field or document lookup", () => {
  const html = renderToStaticMarkup(createElement(ExaminerGuidance, { data: fixture }));
  assert.match(html, /href="tel:\+15715551234"/);
  assert.match(html, /USPTO employee directory/);
  assert.match(html, /Synthetic strategy/);
  assert.doesNotMatch(html, /USPTO Email|never-display@|Source documents|OCR/);
});
test("missing phone has an explicit Not Available state", () => {
  const data = { ...fixture, examinerContact: { ...fixture.examinerContact!, phone: null } };
  assert.match(renderToStaticMarkup(createElement(ExaminerGuidance, { data })), /Not Available/);
});
