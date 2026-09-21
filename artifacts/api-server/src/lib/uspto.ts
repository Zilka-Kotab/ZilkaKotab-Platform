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
  const text = typeof value === "string" ? value.trim().slice(0, 10) : "";
  return UUID_SAFE_DATE.test(text) ? text : null;
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
    throw new UsptoImportError(detail ? `USPTO retrieval failed: ${detail}` : `USPTO retrieval failed with status ${response.status}.`, response.status >= 400 && response.status < 500 ? 400 : 502);
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
  const patentStatus = firstText(metadata, ["applicationStatusDescriptionText", "applicationStatus", "patentStatus"]) ?? "UNKNOWN";
  const filingDate = safeDate(firstText(metadata, ["filingDate", "applicationFilingDate"]));
  const issueDate = safeDate(firstText(metadata, ["grantDate", "issueDate", "patentIssueDate"]));
  const earliestPriorityDate = safeDate(firstText(metadata, ["earliestPriorityDate", "priorityDate", "parentApplicationfilingDate"]));

  let sourceUrl: string | null = null;
  let claims: ImportedClaim[] = [];
  let abstract: string | null = null;
  const errors: string[] = [];

  if (applicationNumber) {
    const documents = await requestJson(`/api/v1/patent/applications/${encodeURIComponent(applicationNumber)}/associated-documents`);
    const documentRecord = valuesForKeys(documents, new Set(["grantdocumentmetadata"])).at(0);
    sourceUrl = extractDocumentUrl(documentRecord);
    if (sourceUrl) {
      try {
        const xml = await requestXml(sourceUrl);
        claims = parseClaims(xml);
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
    patentStatus,
    jurisdiction: "US",
    source: "USPTO",
    sourceIdentifier: applicationNumber ?? `US${patentDigits}`,
    sourceUrl,
    retrievedAt,
    claims,
    errors,
  };
}