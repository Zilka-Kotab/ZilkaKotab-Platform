import type { PublicExaminerHistoricalEvidence, PublicExaminerRoleEvidence } from "@workspace/api-zod";
import { createHash } from "node:crypto";
import { discoverHistoricalGrants, type ExaminerGrantCandidate } from "./examiner-history-discovery";

type Candidate = ExaminerGrantCandidate;
const normalize = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const tag = (xml: string, name: string) =>
  xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "";
const text = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/** Require full name equality; initials and fuzzy matches cannot establish identity. */
export function parseExaminerRole(xml: string, examinerName: string, sourceUrl: string): PublicExaminerRoleEvidence | null {
  if (!/<us-patent-grant\b/i.test(xml)) return null;
  const publication = tag(xml, "publication-reference");
  const patentNumber = text(tag(publication, "doc-number"));
  const date = text(tag(publication, "date"));
  if (!patentNumber || !/^\d{8}$/.test(date)) return null;
  const issueDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`;
  const parsedDate = new Date(issueDate);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== issueDate) return null;
  const examiners = tag(xml, "examiners");
  for (const role of ["primary", "assistant"] as const) {
    const person = tag(examiners, `${role}-examiner`);
    const last = text(tag(person, "last-name"));
    const first = text(tag(person, "first-name"));
    // USPTO search names are LAST, FIRST; also allow complete FIRST LAST input.
    if (!last || !first || ![normalize(`${last} ${first}`), normalize(`${first} ${last}`)].includes(normalize(examinerName))) continue;
    return { role, patentNumber: `US${patentNumber}`, issueDate, sourceUrl,
      note: `Listed as ${role} examiner on this issued patent. Historical document evidence only; not a verified current role, GS grade, or employment start date.` };
  }
  return null;
}

/** Omitted middle names require a same-application canonical ODP assignment
 * plus a whole-result name-conflict check; never use fuzzy/initial-only names. */
export function parseCorroboratedExaminerRole(xml: string, examinerName: string, sourceUrl: string, candidate: Candidate, omittedMiddleAllowed: boolean) {
  const exact = parseExaminerRole(xml, examinerName, sourceUrl);
  if (exact) return exact;
  if (!omittedMiddleAllowed || !candidate.examinerName || normalize(candidate.examinerName) !== normalize(examinerName)) return null;
  const parts = examinerName.split(",");
  const given = normalize(parts[1] ?? "").split(" ");
  if (parts.length !== 2 || given.length < 2 || given[0].length < 2) return null;
  const alias = parseExaminerRole(xml, `${parts[0]}, ${given[0]}`, sourceUrl);
  if (alias) alias.note += " Grant omits the middle name/initial; full given name and surname match, corroborated by the same application's canonical ODP examiner name and no conflicting examiner name in the ODP name-family search. Identity confidence is medium.";
  return alias;
}

function grantUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.grantDocumentMetaData) {
    const grants = Array.isArray(record.grantDocumentMetaData) ? record.grantDocumentMetaData : [record.grantDocumentMetaData];
    for (const grant of grants) {
      if (grant && typeof grant === "object" && typeof grant.fileLocationURI === "string") return grant.fileLocationURI;
    }
  }
  for (const child of Object.values(record)) {
    const found = grantUrl(child);
    if (found) return found;
  }
  return null;
}

async function downloadGrant(location: string, signal: AbortSignal) {
  let url = new URL(location, "https://api.uspto.gov");
  for (let redirect = 0; redirect < 5; redirect++) {
    if (url.protocol !== "https:" || !(url.hostname === "uspto.gov" || url.hostname.endsWith(".uspto.gov"))) {
      throw new Error("Grant document host is not an official USPTO host.");
    }
    const response = await fetch(url, { redirect: "manual", signal, headers: {
      Accept: "application/xml,text/xml",
      ...(url.hostname === "api.uspto.gov" ? { "X-API-KEY": process.env.USPTO_API_KEY ?? "" } : {}),
    } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      if (!next) throw new Error("Grant redirect is missing its destination.");
      url = new URL(next, url); continue;
    }
    if (!response.ok) throw new Error(`Grant document returned ${response.status}.`);
    // A grant is bounded so an unexpectedly large download cannot exhaust memory.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Grant document has no body.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 12_000_000) throw new Error("Grant document exceeded the size limit.");
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many grant document redirects.");
}

const historyCache = new Map<string, { expiresAt: number; value: PublicExaminerRoleEvidence }>();
const historyRequests = new Map<string, Promise<PublicExaminerRoleEvidence>>();

/** Cache verified evidence only; a failed lookup is not negative career evidence. */
export async function findExaminerRole(
  examinerName: string, candidates: Candidate[],
  getMetadata: (url: URL, signal: AbortSignal) => Promise<Response>,
  options: { discoverHistorical?: boolean } = {},
): Promise<PublicExaminerRoleEvidence> {
  const key = createHash("sha256").update(JSON.stringify(["historical-grants-v4", options.discoverHistorical === true, normalize(examinerName),
    [...candidates].sort((a, b) => a.applicationNumber.localeCompare(b.applicationNumber))])).digest("hex");
  const entry = historyCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return structuredClone(entry.value);
  const pending = historyRequests.get(key);
  if (pending) return structuredClone(await pending);
  const request = lookupExaminerRole(examinerName, candidates, getMetadata, options.discoverHistorical === true);
  historyRequests.set(key, request);
  try {
    const value = await request;
    if (value.role) {
      const partial = (value.earliestActivity?.note.includes("failed") ?? false)
        || (value.history?.note.includes("failed") ?? false)
        || (options.discoverHistorical === true && value.history?.yearsObserved == null);
      historyCache.set(key, { value: structuredClone(value), expiresAt: Date.now() + (partial ? 300_000 : 7 * 24 * 60 * 60 * 1000) });
      if (historyCache.size > 256) historyCache.delete(historyCache.keys().next().value!);
    }
    return value;
  } finally { historyRequests.delete(key); }
}

async function lookupExaminerRole(
  examinerName: string, candidates: Candidate[],
  getMetadata: (url: URL, signal: AbortSignal) => Promise<Response>,
  discoverHistorical: boolean,
): Promise<PublicExaminerRoleEvidence> {
  const signal = AbortSignal.timeout(25_000);
  let discovery: Awaited<ReturnType<typeof discoverHistoricalGrants>> | null = null;
  let discoveryFailed = false;
  if (discoverHistorical) {
    try { discovery = await discoverHistoricalGrants(examinerName, getMetadata, signal); }
    catch { discoveryFailed = true; }
  }
  const historicalIds = new Set(discovery?.candidates.map(item => item.applicationNumber));
  candidates = [...new Map([...candidates, ...(discovery?.candidates ?? [])].map(item => [item.applicationNumber, item])).values()];
  const ordered = [...candidates].filter(candidate => /^\d{4}-\d{2}-\d{2}$/.test(candidate.grantDate))
    .sort((a, b) => b.grantDate.localeCompare(a.grantDate));
  // Check both ends of the retrieved sample, prioritizing newest and oldest
  // before spending the remaining bounded lookup budget.
  const newest = ordered.slice(0, 3);
  const oldest = [...ordered].reverse().slice(0, 3);
  const selected = [...new Map(newest.flatMap((candidate, index) => [candidate, oldest[index]])
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .map(candidate => [candidate.applicationNumber, candidate])).values()];
  let failures = 0;
  let checked = 0;
  const matches: PublicExaminerRoleEvidence[] = [];
  const attributed: PublicExaminerHistoricalEvidence[] = [];
  for (const candidate of selected) {
    if (signal.aborted) { failures++; break; }
    checked++;
    try {
      const response = await getMetadata(new URL(`https://api.uspto.gov/api/v1/patent/applications/${encodeURIComponent(candidate.applicationNumber)}/associated-documents`), signal);
      if (!response.ok) throw new Error("Associated grant metadata unavailable.");
      const sourceUrl = grantUrl(await response.json());
      if (!sourceUrl) continue;
      const evidence = parseCorroboratedExaminerRole(await downloadGrant(sourceUrl, signal), examinerName,
        `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${candidate.applicationNumber}`, candidate, discovery?.omittedMiddleAllowed ?? false);
      if (evidence && evidence.issueDate === candidate.grantDate && evidence.issueDate <= new Date().toISOString().slice(0, 10)) {
        // Link to the actual patent, not the application or a temporary download URL.
        evidence.sourceUrl = `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${evidence.patentNumber!.replace(/^US/, "")}`;
        matches.push(evidence);
        attributed.push({ role: evidence.role!, applicationNumber: candidate.applicationNumber,
          patentNumber: evidence.patentNumber!, issueDate: evidence.issueDate!, sourceUrl: evidence.sourceUrl! });
      }
    } catch { failures++; }
  }
  if (matches.length) {
    matches.sort((a, b) => b.issueDate!.localeCompare(a.issueDate!));
    const earliest = matches.at(-1)!;
    const chronological = attributed.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    const earliestPrimary = chronological.find(item => item.role === "primary");
    const earliestAssistant = chronological.find(item => item.role === "assistant");
    const spanYears = (Date.parse(matches[0].issueDate!) - Date.parse(earliest.issueDate!)) / (365.2425 * 86400000);
    // This is a lower bound between verified documents, not a career-wide
    // estimate. Do not turn a recent-only subset into "<1 year of experience."
    const historicalSpan = Boolean(discovery && historicalIds.has(chronological[0].applicationNumber)
      && new Set(chronological.map(item => item.applicationNumber)).size >= 2 && spanYears >= 1);
    return {
      ...matches[0],
      history: {
        coverageStatus: historicalSpan ? "historical" : "sampled", confidence: historicalSpan ? "medium" : "low",
        confidenceNote: historicalSpan
          ? "Medium confidence in the documented activity span: dated grant roles are verified against the selected examiner's canonical ODP application records. Omitted middle names are accepted only after checking for conflicting names. This lower bound does not establish complete career history, continuous service, or years employed."
          : "Insufficient historical evidence for an activity span. Current-docket records alone cannot establish career length; duplicate people, name variations, and missing records may prevent attribution.",
        source: "USPTO ODP associated grant XML",
        yearsObserved: historicalSpan ? Math.floor(spanYears * 10) / 10 : null,
        distinctApplicationsVerified: new Set(attributed.map(item => item.applicationNumber.replace(/\D/g, ""))).size,
        totalHistoricallyExamined: null,
        earliestPrimary, earliestAssistant,
        transitionStatus: earliestPrimary && earliestAssistant && earliestAssistant.issueDate < earliestPrimary.issueDate
          ? "observed_sequence" : "not_established",
        note: `Checked ${checked} oldest/newest grant candidates${discovery ? " including a separate oldest-grant search across the selected examiner's ODP records" : " from the retrieved current-assignment sample"}${failures ? "; some document checks failed or timed out" : ""}.${discoveryFailed ? " Historical search failed; numeric years are withheld." : ""} Counts cover named grant roles, not personally signed examination actions. Any displayed years are a lower-bound span between dated documents, not years employed. Earlier activity and gaps may exist. Career-wide totals and promotion dates are withheld. PatEx historical data has not been indexed or identity-resolved.`,
        evidence: chronological,
      },
      earliestActivity: {
        patentNumber: earliest.patentNumber!, issueDate: earliest.issueDate!, sourceUrl: earliest.sourceUrl!,
        note: `Earliest attributed grant verified among ${checked} checked grant candidates${discovery ? " including the separate historical ODP search" : " from the retrieved application sample"}. Not a hire date, continuous service, or a complete career history.${failures ? " Some document checks failed or timed out; earlier evidence may be missing." : " Earlier examiner activity may exist outside these records."}`,
      },
    };
  }
  return { role: null, patentNumber: null, issueDate: null, sourceUrl: null,
    note: failures
      ? "Role verification incomplete: a USPTO document lookup failed or timed out. No current role or grade can be inferred."
      : `No exact-name role evidence found in ${checked} grant candidates from the retrieved sample. This does not establish that the examiner is not a primary examiner.` };
}
