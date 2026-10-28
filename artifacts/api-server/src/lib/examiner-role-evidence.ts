import type { PublicExaminerRoleEvidence } from "@workspace/api-zod";

type Candidate = { applicationNumber: string; grantDate: string };
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

export async function findExaminerRole(
  examinerName: string, candidates: Candidate[],
  getMetadata: (url: URL, signal: AbortSignal) => Promise<Response>,
): Promise<PublicExaminerRoleEvidence> {
  const ordered = [...candidates].filter(candidate => /^\d{4}-\d{2}-\d{2}$/.test(candidate.grantDate))
    .sort((a, b) => b.grantDate.localeCompare(a.grantDate));
  // Check both ends of the retrieved sample, prioritizing newest and oldest
  // before spending the remaining bounded lookup budget.
  const newest = ordered.slice(0, 3);
  const oldest = [...ordered].reverse().slice(0, 3);
  const selected = [...new Map(newest.flatMap((candidate, index) => [candidate, oldest[index]])
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .map(candidate => [candidate.applicationNumber, candidate])).values()];
  const signal = AbortSignal.timeout(20_000);
  let failures = 0;
  let checked = 0;
  const matches: PublicExaminerRoleEvidence[] = [];
  for (const candidate of selected) {
    if (signal.aborted) { failures++; break; }
    checked++;
    try {
      const response = await getMetadata(new URL(`https://api.uspto.gov/api/v1/patent/applications/${encodeURIComponent(candidate.applicationNumber)}/associated-documents`), signal);
      if (!response.ok) throw new Error("Associated grant metadata unavailable.");
      const sourceUrl = grantUrl(await response.json());
      if (!sourceUrl) continue;
      const evidence = parseExaminerRole(await downloadGrant(sourceUrl, signal), examinerName,
        `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${candidate.applicationNumber}`);
      if (evidence) {
        // Link to the actual patent, not the application or a temporary download URL.
        evidence.sourceUrl = `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${evidence.patentNumber!.replace(/^US/, "")}`;
        matches.push(evidence);
      }
    } catch { failures++; }
  }
  if (matches.length) {
    matches.sort((a, b) => b.issueDate!.localeCompare(a.issueDate!));
    const earliest = matches.at(-1)!;
    return {
      ...matches[0],
      earliestActivity: {
        patentNumber: earliest.patentNumber!, issueDate: earliest.issueDate!, sourceUrl: earliest.sourceUrl!,
        note: `Elapsed time since the earliest exact-name grant verified among ${checked} checked grant candidates from the retrieved application sample. Not a hire date, continuous service, or a complete career history.${failures ? " Some document checks failed or timed out; earlier evidence may be missing." : " Earlier examiner activity may exist outside these records."}`,
      },
    };
  }
  return { role: null, patentNumber: null, issueDate: null, sourceUrl: null,
    note: failures
      ? "Role verification incomplete: a USPTO document lookup failed or timed out. No current role or grade can be inferred."
      : `No exact-name role evidence found in ${checked} grant candidates from the retrieved sample. This does not establish that the examiner is not a primary examiner.` };
}
