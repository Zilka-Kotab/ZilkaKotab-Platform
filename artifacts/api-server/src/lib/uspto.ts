const USPTO_API_BASE = "https://api.uspto.gov";
const SEARCH_PATH = "/api/v1/patent/applications/search";
const UUID_SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ImportedClaim = {
  claimNumber: string;
  claimText: string;
  claimType: "INDEPENDENT" | "DEPENDENT" | "UNKNOWN";
  dependsOnClaimNumber: string | null;
  selectedForMonitoring: boolean;
};

export type PatentImportPayload = {
  normalizedPatentNumber: string;
  title: string;
  applicationNumber: string | null;
  filingDate: string | null;
  issueDate: string | null;
  earliestPriorityDate: string | null;
  assignee: string | null;
  inventors: string[];
  abstract: string | null;
  sourceStatus: string;
  patentStatus: string;
  jurisdiction: "US";
  source: "USPTO";
  sourceIdentifier: string;
  sourceUrl: string | null;
  retrievedAt: string;
  claims: ImportedClaim[];
  errors: string[];
};

export class UsptoImportError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "UsptoImportError";
  }
}

function apiKey() {
  const key = process.env.USPTO_API_KEY?.trim();
  if (!key) throw new UsptoImportError("USPTO retrieval is not configured. An administrator must add the USPTO API key.", 503);
  return key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function valuesForKeys(value: unknown, keys: Set<string>, output: unknown[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) valuesForKeys(item, keys, output);
    return output;
  }
  const record = asRecord(value);
  if (!record) return output;
  for (const [key, item] of Object.entries(record)) {
    if (keys.has(key.toLowerCase())) output.push(item);
    valuesForKeys(item, keys, output);
  }
  return output;
}

function firstText(value: unknown, keys: string[]) {
  const candidates = valuesForKeys(value, new Set(keys.map((key) => key.toLowerCase())));
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number") return String(candidate);
  }
  return null;
}

function arrayFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function normalizeDigits(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\D/g, "")
    : "";
}

function safeDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const isoDate = text.slice(0, 10);
  return UUID_SAFE_DATE.test(isoDate) ? isoDate : null;
}

export function normalizePatentStatus(issueDate: string | null, sourceStatus: string | null, officialGrantRetrieved: boolean) {
  const normalizedSource = (sourceStatus ?? "").toLowerCase();
  if (normalizedSource.includes("expired")) return "Expired";
  if (normalizedSource.includes("lapsed")) return "Lapsed";
  if (normalizedSource.includes("canceled") || normalizedSource.includes("cancelled") || normalizedSource.includes("disclaimed")) {
    return "Canceled/Disclaimed";
  }
  if (issueDate || officialGrantRetrieved) return "Issued";
  if (normalizedSource.includes("pending")) return "Pending";
  return "Unknown";
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function collectXmlText(fragment: string) {
  const parts: string[] = [];
  const tokens = fragment.match(/<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) ?? [];
  const appendBoundary = () => {
    const current = parts.at(-1) ?? "";
    if (current && !current.endsWith("\n")) parts.push("\n");
  };

  for (const token of tokens) {
    if (token.startsWith("<")) {
      const tagName = token.match(/^<\s*\/?\s*([A-Za-z0-9:_-]+)/)?.[1]?.toLowerCase();
      if (tagName === "claim-text") {
        if (token.startsWith("</")) appendBoundary();
        else if (parts.length) appendBoundary();
      } else if (tagName === "br" || tagName === "p" || tagName === "paragraph") {
        appendBoundary();
      }
      continue;
    }
    const text = token.startsWith("<![CDATA[")
      ? token.slice(9, -3)
      : decodeXmlEntities(token);
    parts.push(text);
  }

  return parts.join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function xmlTagText(xml: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const expression = new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${tagName}>`, "i");
    const match = xml.match(expression);
    if (match?.[1]) return collectXmlText(match[1]);
  }
  return null;
}

export function parseClaims(xml: string): ImportedClaim[] {
  const claims: ImportedClaim[] = [];
  const claimExpression = /<(?:(?:[A-Za-z0-9_-]+):)?claim\b([^>]*)>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_-]+):)?claim>/gi;
  for (const match of xml.matchAll(claimExpression)) {
    const attributes = match[1];
    const inner = match[2];
    const claimText = collectXmlText(inner);
    if (!claimText) continue;
    const numberMatch = attributes.match(/\bnum\s*=\s*["']?0*(\d+)/i) ?? attributes.match(/\bid\s*=\s*["'][^"']*?0*(\d+)["']/i);
    const claimNumber = numberMatch?.[1] ?? String(claims.length + 1);
    const dependencyMatch = claimText.match(/\bclaims?\s+(\d+)/i);
    const dependsOnClaimNumber = dependencyMatch?.[1] ?? null;
    claims.push({
      claimNumber,
      claimText,
      claimType: dependsOnClaimNumber ? "DEPENDENT" : "INDEPENDENT",
      dependsOnClaimNumber,
      selectedForMonitoring: !dependsOnClaimNumber && claims.every((claim) => !claim.selectedForMonitoring),
    });
  }
  return claims;
}

async function requestJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${USPTO_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  let parsed: unknown = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const detail = firstText(parsed, ["errorDetails", "error", "message"]);
    const status = response.status === 404 ? 404 : response.status >= 400 && response.status < 500 ? 400 : 502;
    throw new UsptoImportError(detail ? `USPTO retrieval failed: ${detail}` : `USPTO retrieval failed with status ${response.status}.`, status);
  }
  return parsed;
}

async function requestXml(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml", "X-API-KEY": apiKey() },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new UsptoImportError(`USPTO grant document could not be retrieved (status ${response.status}).`, 502);
  return response.text();
}

function extractDocumentUrl(value: unknown) {
  const url = firstText(value, [
    "documentLocationURI",
    "documentLocationUri",
    "documentUrl",
    "documentURL",
    "downloadUrl",
    "fileLocationURI",
    "fileLocationUri",
  ]);
  if (!url) return null;
  try {
    return new URL(url, USPTO_API_BASE).toString();
  } catch {
    return null;
  }
}

function extractInventors(value: unknown) {
  const entries = valuesForKeys(value, new Set(["inventorbag"])).flatMap(arrayFrom);
  const names = entries.flatMap((entry) => {
    const nested = arrayFrom(entry);
    return nested.map((item) => firstText(item, ["inventorNameText", "inventorName", "name"])).filter((name): name is string => Boolean(name));
  });
  return [...new Set(names)];
}

function extractAssignee(value: unknown) {
  return firstText(value, [
    "assigneeNameText",
    "assigneeName",
    "currentAssigneeName",
    "applicantNameText",
    "applicantName",
  ]);
}

function extractRecord(body: unknown, digits: string) {
  const candidates = valuesForKeys(body, new Set(["patentfilewrapperdatabag"])).flatMap(arrayFrom);
  return candidates.find((candidate) => normalizeDigits(firstText(candidate, ["patentNumber"])) === digits) ?? candidates[0] ?? null;
}

export function normalizePatentNumbers(input: unknown) {
  if (typeof input !== "string") return [];
  const cleaned = input.toUpperCase().replace(/,/g, "");
  const matches = cleaned.match(/(?:US\s*)?\d{6,9}(?:\s*[A-Z]\d)?/g) ?? [];
  return [...new Set(matches.map((match) => {
    const digits = normalizeDigits(match);
    return digits ? `US${digits}` : "";
  }).filter(Boolean))];
}

export type UsptoAssigneePatent = {
  normalizedPatentNumber: string;
  title: string;
  assignee: string;
  applicationNumber: string | null;
  issueDate: string | null;
  matchSources: Array<
    | { type: "application"; matchedName: string }
    | { type: "assignment"; matchedName: string; partyRole: "ASSIGNEE" | "ASSIGNOR"; recordedDate: string | null; conveyance: string | null }
  >;
};

const ASSIGNMENT_LOOKUP_LIMIT = 500;
const ASSIGNMENT_CONCURRENCY = 10;

function normalizedAssigneeNames(input: string, alternates: string[]) {
  const assignee = input.trim().replace(/\s+/g, " ");
  if (assignee.length < 2 || assignee.length > 120) {
    throw new UsptoImportError("Enter an assignee name between 2 and 120 characters.", 400);
  }
  if (alternates.length > 10) throw new UsptoImportError("Search with up to 10 alternate assignee names at a time.", 400);
  const names = [assignee, ...alternates.map((name) => name.trim().replace(/\s+/g, " "))];
  if (names.some((name) => name.length < 2 || name.length > 120)) {
    throw new UsptoImportError("Each alternate assignee name must be between 2 and 120 characters.", 400);
  }
  return [...new Map(names.map((name) => [name.toLocaleLowerCase(), name])).values()];
}

function assigneeSearchQuery(assignee: string) {
  const escaped = assignee.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `applicationMetaData.assigneeBag.assigneeNameText:"${escaped}"`;
}

function addMatchSource<T extends UsptoAssigneePatent["matchSources"][number]>(patent: UsptoAssigneePatent, source: T) {
  const exists = patent.matchSources.some((match) =>
    match.type === source.type &&
    match.matchedName.toLocaleLowerCase() === source.matchedName.toLocaleLowerCase() &&
    (match.type !== "assignment" || source.type !== "assignment" ||
      (match.partyRole === source.partyRole && match.recordedDate === source.recordedDate && match.conveyance === source.conveyance)),
  );
  if (!exists) patent.matchSources.push(source);
}

async function assignmentRecords(applicationNumber: string) {
  try {
    const body = await requestJson(`/api/v1/patent/applications/${encodeURIComponent(applicationNumber)}/assignment`);
    return valuesForKeys(body, new Set(["assignmentbag"])).flatMap(arrayFrom);
  } catch (error) {
    if (error instanceof UsptoImportError && error.status === 404) return [];
    throw error;
  }
}

function assignmentMatches(record: unknown, names: string[]) {
  const matchForRole = (keys: string[], partyRole: "ASSIGNEE" | "ASSIGNOR") => {
    const partyNames = valuesForKeys(record, new Set(keys)).filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    return partyNames.flatMap((partyName) => {
      const matchingName = names.find((name) => partyName.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
      return matchingName ? [{
        type: "assignment" as const,
        matchedName: partyName.trim(),
        partyRole,
        recordedDate: safeDate(firstText(record, ["assignmentRecordedDate", "recordedDate"])),
        conveyance: firstText(record, ["conveyanceText"]),
      }] : [];
    });
  };
  return [
    ...matchForRole(["assigneenametext"], "ASSIGNEE"),
    ...matchForRole(["assignorname"], "ASSIGNOR"),
  ];
}

export async function searchPatentsByAssignee(
  input: string,
  options: { alternateAssignees?: string[]; includeAssignments?: boolean } = {},
) {
  const alternateAssignees = options.alternateAssignees ?? [];
  if (!Array.isArray(alternateAssignees) || alternateAssignees.some((name) => typeof name !== "string")) {
    throw new UsptoImportError("Alternate assignee names must be text values.", 400);
  }
  const names = normalizedAssigneeNames(input, alternateAssignees);
  const pageSize = 100;
  const maxResults = 5000;
  const matches = new Map<string, UsptoAssigneePatent>();
  let truncated = false;

  for (const name of names) {
    const query = assigneeSearchQuery(name);
    for (let offset = 0; offset < maxResults; offset += pageSize) {
      const body = await requestJson(`${SEARCH_PATH}?q=${encodeURIComponent(query)}&limit=${pageSize}&offset=${offset}`);
      const records = valuesForKeys(body, new Set(["patentfilewrapperdatabag"])).flatMap(arrayFrom);
      if (!records.length) break;
      for (const record of records) {
        const metadata = asRecord(record)?.applicationMetaData ?? record;
        const assigneeNames = valuesForKeys(metadata, new Set(["assigneenametext"]))
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
        const matchedAssignee = assigneeNames.find((candidate) => candidate.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
        if (!matchedAssignee) continue;
        const digits = normalizeDigits(firstText(record, ["patentNumber"]));
        if (!/^\d{6,9}$/.test(digits)) continue;
        const patentNumber = `US${digits}`;
        const existing = matches.get(patentNumber);
        const patent: UsptoAssigneePatent = existing ?? {
          normalizedPatentNumber: patentNumber,
          title: firstText(metadata, ["inventionTitle", "title"]) ?? "",
          assignee: matchedAssignee.trim(),
          applicationNumber: firstText(record, ["applicationNumberText", "applicationNumber"]),
          issueDate: safeDate(firstText(metadata, ["grantDate", "issueDate", "patentIssueDate"])),
          matchSources: [],
        };
        addMatchSource(patent, { type: "application", matchedName: matchedAssignee.trim() });
        matches.set(patentNumber, patent);
      }
      if (records.length < pageSize) break;
      if (offset + pageSize >= maxResults) truncated = true;
    }
  }

  let assignmentSearchTruncated = false;
  if (options.includeAssignments) {
    const candidates = [...matches.values()]
      .sort((left, right) => (right.issueDate ?? "").localeCompare(left.issueDate ?? ""));
    const assignmentCandidates = candidates.filter((patent) => patent.applicationNumber).slice(0, ASSIGNMENT_LOOKUP_LIMIT);
    assignmentSearchTruncated = candidates.length > assignmentCandidates.length;
    for (let offset = 0; offset < assignmentCandidates.length; offset += ASSIGNMENT_CONCURRENCY) {
      const batch = assignmentCandidates.slice(offset, offset + ASSIGNMENT_CONCURRENCY);
      const assignmentResults = await Promise.all(batch.map(async (patent) => ({
        patent,
        records: await assignmentRecords(patent.applicationNumber!),
      })));
      for (const { patent, records } of assignmentResults) {
        for (const record of records) {
          for (const source of assignmentMatches(record, names)) addMatchSource(patent, source);
        }
      }
    }
  }

  const results = [...matches.values()].sort((left, right) =>
    (right.issueDate ?? "").localeCompare(left.issueDate ?? "") || left.normalizedPatentNumber.localeCompare(right.normalizedPatentNumber),
  );
  return { results, truncated, ...(options.includeAssignments ? { assignmentSearchTruncated } : {}) };
}

export async function retrievePatent(normalizedPatentNumber: string): Promise<PatentImportPayload> {
  const patentDigits = normalizeDigits(normalizedPatentNumber);
  const retrievedAt = new Date().toISOString();
  if (!/^\d{6,9}$/.test(patentDigits)) throw new UsptoImportError("Enter a valid U.S. issued patent number.");

  const searchBody = await requestJson(`${SEARCH_PATH}?q=${encodeURIComponent(patentDigits)}&limit=25`);
  const record = extractRecord(searchBody, patentDigits);
  if (!record) throw new UsptoImportError(`USPTO could not find issued patent ${normalizedPatentNumber}.`, 404);

  const applicationNumber = firstText(record, ["applicationNumberText", "applicationNumber"]);
  const metadata = asRecord(record)?.applicationMetaData ?? record;
  let title = firstText(metadata, ["inventionTitle", "title"]) ?? "";
  const sourceStatus = firstText(metadata, ["applicationStatusDescriptionText", "applicationStatus", "patentStatus"]) ?? "UNKNOWN";
  const filingDate = safeDate(firstText(metadata, ["filingDate", "applicationFilingDate"]));
  let issueDate = safeDate(firstText(metadata, ["grantDate", "issueDate", "patentIssueDate"]));
  const earliestPriorityDate = safeDate(firstText(metadata, ["earliestPriorityDate", "priorityDate", "parentApplicationfilingDate"]));

  let sourceUrl: string | null = null;
  let claims: ImportedClaim[] = [];
  let abstract: string | null = null;
  let officialGrantRetrieved = false;
  const errors: string[] = [];

  if (applicationNumber) {
    const documents = await requestJson(`/api/v1/patent/applications/${encodeURIComponent(applicationNumber)}/associated-documents`);
    const documentRecord = valuesForKeys(documents, new Set(["grantdocumentmetadata"])).at(0);
    sourceUrl = extractDocumentUrl(documentRecord);
    if (sourceUrl) {
      try {
        const xml = await requestXml(sourceUrl);
        officialGrantRetrieved = true;
        claims = parseClaims(xml);
        if (!issueDate) {
          const xmlIssueDate = safeDate(xmlTagText(xml, ["date-of-grant", "grant-date", "issue-date"]));
          if (xmlIssueDate) issueDate = xmlIssueDate;
        }
        const xmlTitle = xmlTagText(xml, ["invention-title", "inventionTitle"]);
        if (!title && xmlTitle) title = xmlTitle;
        abstract = xmlTagText(xml, ["abstract"]);
        if (!claims.length) errors.push("The USPTO grant document was retrieved, but no claims could be parsed.");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "The USPTO grant document could not be retrieved.");
      }
    } else {
      errors.push("USPTO returned bibliographic data but no grant XML document URL.");
    }
  } else {
    errors.push("USPTO did not return an application number for this patent.");
  }
  if (!title) errors.push("USPTO did not return a patent title.");

  return {
    normalizedPatentNumber: `US${patentDigits}`,
    title,
    applicationNumber,
    filingDate,
    issueDate,
    earliestPriorityDate,
    assignee: extractAssignee(metadata),
    inventors: extractInventors(metadata),
    abstract,
    sourceStatus,
    patentStatus: normalizePatentStatus(issueDate, sourceStatus, officialGrantRetrieved),
    jurisdiction: "US",
    source: "USPTO",
    sourceIdentifier: applicationNumber ?? `US${patentDigits}`,
    sourceUrl,
    retrievedAt,
    claims,
    errors,
  };
}