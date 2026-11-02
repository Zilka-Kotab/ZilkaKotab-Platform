import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicExaminerAnalysis } from "@workspace/api-client-react";
import { ExaminerGuidance } from "./ExaminerGuidance";
import { examinerAiLinks, examinerAiPrompt } from "./examiner-ai-prompt";

const fixture = {
  searchType: "examiner", examinerName: "Synthetic Example",
  examinerContact: { status: "matched", phone: "(571) 555-1234", email: "never-display@uspto.gov",
    verificationMethod: "directory", confidence: "moderate", checkedAt: "2026-11-02T00:00:00Z", note: "Directory listing" },
  recommendedStrategy: { status: "ready", summary: "Synthetic strategy", approach: "Review → discuss", note: "Synthetic evidence" },
} as unknown as PublicExaminerAnalysis;

test("contact section displays phone and external AI links, without caveat or generated strategy", () => {
  const html = renderToStaticMarkup(createElement(ExaminerGuidance, { data: fixture }));
  assert.match(html, /href="tel:\+15715551234"/);
  assert.match(html, /ChatGPT/);
  assert.match(html, /Claude/);
  assert.match(html, /Microsoft Copilot/);
  assert.match(html, /Copy metrics/);
  assert.doesNotMatch(html, /USPTO Email|never-display@|Source documents|OCR|Contact evidence|Verified |Directory listing|Synthetic strategy|AI Recommended Strategy/);
});
test("external prompt includes actual metrics, preserves missing values, and excludes contact details", () => {
  const data = { ...fixture, estimatedAllowanceRate: 81.5, averageProsecutionDurationMonths: null };
  const prompt = examinerAiPrompt(data);
  assert.match(prompt, /"overallAllowancePercent":81.5/);
  assert.match(prompt, /"averageProsecutionMonths":null/);
  assert.match(prompt, /observational/);
  assert.doesNotMatch(prompt, /never-display@|555-1234|Synthetic strategy/);
  for (const link of examinerAiLinks(prompt).slice(0, 2)) {
    assert.equal(new URL(link.href).searchParams.get("q"), prompt);
  }
});
test("missing phone has an explicit Not Available state", () => {
  const data = { ...fixture, examinerContact: { ...fixture.examinerContact!, phone: null } };
  assert.match(renderToStaticMarkup(createElement(ExaminerGuidance, { data })), /Not Available/);
});
