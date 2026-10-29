import { findExaminerRole } from "./examiner-role-evidence";
import { calculateExaminerBehaviorMetrics } from "./examiner-behavior-metrics";
import { queueExaminerRateJob } from "./examiner-rce-store";
import { RCE_CALCULATION_VERSION } from "./examiner-rce-evidence";
import { discoverCompanyNames, uniqueCompanyNames, explicitOrganizationNames, applicantNameMatches, applicantScopeQuery, organizationNameKey } from "./company-name-discovery";
import { usptoSearchBody } from "./uspto-search-body";
import { analyzePortfolioCounsel, COUNSEL_SEARCH_FIELDS } from "./portfolio-counsel";
import { logger } from "./logger";
import { metricApplication, calculatePortfolioMetrics } from "./portfolio-metrics";
import { computeFirmBenchmark } from "./firm-benchmark-math";
import { firmSnapshot } from "./firm-benchmark-store";
import { portfolioSamplePages } from "./portfolio-sampling";

const USPTO_API_BASE = "https://api.uspto.gov";
const SEARCH_PATH = "/api/v1/patent/applications/search";
const RESULT_LIMIT = 2000;
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;
const USPTO_REQUEST_SPACING_MS = 250;
const STATUS_FACET = "applicationMetaData.applicationStatusDescriptionText";

type JsonRecord = Record<string, unknown>;

type SearchResult = {
  count: number;
  records: JsonRecord[];
  truncated: boolean;
};

type FacetEntry = {
  value: string;
  count: number;
};

type AggregateResult = {
  count: number;
  records: JsonRecord[];
  facets: Record<string, FacetEntry[]>;
};

type CachedValue = {
  expiresAt: number;
  value: unknown;
};

const resultCache = new Map<string, CachedValue>();
const inFlightCache = new Map<string, Promise<unknown>>();
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

const CPC_SECTIONS: Record<string, string> = {
  A: "Human necessities",
  B: "Performing operations and transporting",
  C: "Chemistry and metallurgy",
  D: "Textiles and paper",
  E: "Fixed constructions",
  F: "Mechanical engineering",
  G: "Physics and computing",
  H: "Electricity",
  Y: "Emerging cross-sectional technologies",
};

export class PublicPatentToolError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "PublicPatentToolError";
  }
}

function apiKey() {
  const key = process.env.USPTO_API_KEY?.trim();
  if (!key) throw new PublicPatentToolError("USPTO data access is not configured.", 503);
  return key;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestUspto(url: URL, signal?: AbortSignal, searchBody?: JsonRecord) {
  if (!searchBody && url.pathname === "/api/v1/patent/applications/search" && url.toString().length > 6500) {
    try { searchBody = usptoSearchBody(url); }
    catch { throw new PublicPatentToolError("This company-name scope cannot be represented as a supported USPTO search. Refine the name selection.", 400); }
  }
  const target = searchBody ? new URL(url.pathname, url.origin) : url;
  const previous = requestQueue;
  let release = () => {};
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  const waitFor = Math.max(0, lastRequestAt + USPTO_REQUEST_SPACING_MS - Date.now());
  if (waitFor) await delay(waitFor);
  lastRequestAt = Date.now();
  release();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(target, {
      method: searchBody ? "POST" : "GET",
      headers: { Accept: "application/json", "X-API-KEY": apiKey(), ...(searchBody ? { "Content-Type": "application/json" } : {}) },
      body: searchBody ? JSON.stringify(searchBody) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    });
    if (response.status !== 429 || attempt === 3) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 750 * (attempt + 1));
  }
  throw new PublicPatentToolError("USPTO rate limit did not clear.", 502);
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function metadata(record: JsonRecord) {
  return asRecord(record.applicationMetaData) ?? {};
}

function recordsFrom(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  }) : [];
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeOrganization(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|lp)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function organizationAcronym(value: string) {
  const words = normalizeOrganization(value)
    .split(" ")
    .filter((word) => word && !["the", "of", "and", "research", "center", "technology", "licensing"].includes(word));
  return words.map((word) => word[0]).join("").toLocaleUpperCase();
}

function round(value: number, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function monthsBetween(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) return null;
  return (endDate.valueOf() - startDate.valueOf()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

async function requestSearch(query: string, fields: string, sampling?: { total: number }): Promise<SearchResult> {
  const records: JsonRecord[] = [];
  let count = 0;

  const pages = sampling ? portfolioSamplePages(sampling.total, RESULT_LIMIT, PAGE_SIZE)
    : Array.from({ length: RESULT_LIMIT / PAGE_SIZE }, (_, i) => ({ offset: i * PAGE_SIZE, limit: PAGE_SIZE }));
  for (const { offset, limit } of pages) {
    const url = new URL(`${USPTO_API_BASE}${SEARCH_PATH}`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("fields", fields);
    const response = await requestUspto(url);
    const bodyText = await response.text();
    let body: JsonRecord = {};
    try {
      body = asRecord(bodyText ? JSON.parse(bodyText) : {}) ?? {};
    } catch {
      body = {};
    }
    if (response.status === 404) {
      if (sampling?.total) throw new PublicPatentToolError("USPTO results changed while retrieving the prosecution sample. Please run the search again.");
      return { count: 0, records: [], truncated: false };
    }
    if (!response.ok) {
      const detail = text(body.detailedMessage) ?? text(body.message);
      const status = response.status === 429 ? 502 : response.status >= 400 && response.status < 500 ? 400 : 502;
      throw new PublicPatentToolError(detail ?? `USPTO request failed with status ${response.status}.`, status);
    }

    count = numberValue(body.count);
    if (sampling && count !== sampling.total) throw new PublicPatentToolError("USPTO result counts changed during sampling. Please run the search again.");
    const page = Array.isArray(body.patentFileWrapperDataBag)
      ? body.patentFileWrapperDataBag.filter((item): item is JsonRecord => Boolean(asRecord(item)))
      : [];
    if (sampling && page.length !== limit) throw new PublicPatentToolError("USPTO returned an incomplete prosecution sample. Please run the search again.");
    records.push(...page);
    if (page.length < limit || records.length >= count) break;
  }
  if (sampling) {
    count = sampling.total;
    const uniqueApplications = new Set(records.map(r => text(r.applicationNumberText)));
    if (uniqueApplications.has(null) || uniqueApplications.size !== records.length) {
      throw new PublicPatentToolError("USPTO pagination repeated or omitted application identifiers. Please run the search again.");
    }
  }
  return { count, records, truncated: count > records.length };
}

async function requestAggregate(
  query: string,
  options: { facets?: string[]; limit?: number } = {},
): Promise<AggregateResult> {
  const url = new URL(`${USPTO_API_BASE}${SEARCH_PATH}`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(options.limit ?? 1));
  url.searchParams.set("offset", "0");
  url.searchParams.set("fields", "applicationNumberText,applicationMetaData");
  if (options.facets?.length) url.searchParams.set("facets", options.facets.join(","));
  const response = await requestUspto(url);
  const bodyText = await response.text();
  let body: JsonRecord = {};
  try {
    body = asRecord(bodyText ? JSON.parse(bodyText) : {}) ?? {};
  } catch {
    body = {};
  }
  if (response.status === 404) return { count: 0, records: [], facets: {} };
  if (!response.ok) {
    const detail = text(body.detailedMessage) ?? text(body.message);
    const status = response.status === 429 ? 502 : response.status >= 400 && response.status < 500 ? 400 : 502;
    throw new PublicPatentToolError(detail ?? `USPTO request failed with status ${response.status}.`, status);
  }
  const rawFacets = asRecord(body.facets) ?? {};
  const facets = Object.fromEntries(Object.entries(rawFacets).map(([key, value]) => [
    key,
    Array.isArray(value)
      ? value.flatMap((entry) => {
          const item = asRecord(entry);
          const facetValue = text(item?.value);
          return facetValue ? [{ value: facetValue, count: numberValue(item?.count) }] : [];
        })
      : [],
  ]));
  const records = Array.isArray(body.patentFileWrapperDataBag)
    ? body.patentFileWrapperDataBag.filter((item): item is JsonRecord => Boolean(asRecord(item)))
    : [];
  return { count: numberValue(body.count), records, facets };
}

async function cached<T>(key: string, load: () => Promise<T>) {
  const entry = resultCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;
  const pending = inFlightCache.get(key);
  if (pending) return pending as Promise<T>;
  const request = load();
  inFlightCache.set(key, request);
  try {
    const value = await request;
    resultCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    if (resultCache.size > 100) {
      const oldest = resultCache.keys().next().value;
      if (oldest) resultCache.delete(oldest);
    }
    return value;
  } finally {
    inFlightCache.delete(key);
  }
}

function isGranted(meta: JsonRecord) {
  const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
  return Boolean(text(meta.patentNumber) || text(meta.grantDate) || status.includes("patented case"));
}

function isAbandoned(meta: JsonRecord) {
  return (text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "").includes("abandon");
}

function dispositionCounts(facets: Record<string, FacetEntry[]>) {
  const statuses = facets[STATUS_FACET] ?? [];
  let allowed = 0;
  let abandoned = 0;
  for (const facet of statuses) {
    const status = facet.value.toLocaleLowerCase();
    if (status.includes("abandon")) abandoned += facet.count;
    else if (
      status.includes("patented case") ||
      status.includes("patent expired") ||
      status.includes("notice of allowance") ||
      status.includes("allowed") ||
      status.includes("issue fee payment verified") ||
      status.includes("issue fee payment received")
    ) allowed += facet.count;
  }
  const disposed = allowed + abandoned;
  return {
    allowed,
    abandoned,
    disposed,
    allowanceRate: statuses.length && disposed ? round((allowed / disposed) * 100) : null,
    hasStatusData: statuses.length > 0,
  };
}

function isAllowedStatus(statusInput: string) {
  const status = statusInput.toLocaleLowerCase();
  return status.includes("patented case") ||
    status.includes("patent expired") ||
    status.includes("notice of allowance") ||
    status.includes("allowed") ||
    status.includes("issue fee payment verified") ||
    status.includes("issue fee payment received");
}

export async function analyzePortfolio(companyNameInput: string, selectedApplicantNames?: string[], additionalCompanyNames: string[] = []) {
  const companyName = companyNameInput.trim().replace(/\s+/g, " ");
  const normalizedCompany = organizationNameKey(companyName);
  if (normalizedCompany.length < 2) throw new PublicPatentToolError("Enter a more specific company name.", 400);
  if (additionalCompanyNames.length > 50 || additionalCompanyNames.some(n => typeof n !== "string" || n.trim().length < 2 || n.length > 200)) {
    throw new PublicPatentToolError("Enter at most 50 additional company names, each 2–200 characters.", 400);
  }

  const selectedKey = selectedApplicantNames?.slice().sort() ?? null;
  const additional = uniqueCompanyNames(additionalCompanyNames);
  return cached(`portfolio-grant-trends-v3:${JSON.stringify([companyName.toLowerCase(), additional.slice().sort(), selectedKey])}`, async () => {
    const nameDiscovery = await discoverCompanyNames(companyName, additional);
    if (nameDiscovery.searchedNames.length > 100) throw new PublicPatentToolError("More than 100 search names were discovered. Refine the corporate identity or additional-name list.", 400);
    let discovery: AggregateResult;
    for (let pass = 0; ; pass++) {
      const nameQuery = nameDiscovery.searchedNames.map(n => `"${escapeQuery(n)}"`).join(" OR ");
      discovery = await requestAggregate(`(${nameQuery})`, { facets: ["applicationMetaData.firstApplicantName"] });
      const annotated = (discovery.facets["applicationMetaData.firstApplicantName"] ?? [])
        .filter(c => applicantNameMatches(c.value, nameDiscovery.searchedNames))
        .flatMap(c => {
          const parts = explicitOrganizationNames(c.value);
          return parts.length > 1 ? parts : [];
        });
      const expanded = uniqueCompanyNames([...nameDiscovery.searchedNames, ...annotated]);
      if (expanded.length === nameDiscovery.searchedNames.length) break;
      if (pass >= 3 || expanded.length > 100) {
        nameDiscovery.warnings.push("Additional explicit name relationships exceeded the discovery window. Add known names manually or refine the entity; this result is not exhaustive.");
        break;
      }
      nameDiscovery.searchedNames = expanded;
      const source = nameDiscovery.sources.find(s => s.label === "USPTO explicit DBA/former-name annotations");
      if (source) source.names = uniqueCompanyNames([...source.names, ...annotated]);
      else nameDiscovery.sources.push({ label: "USPTO explicit DBA/former-name annotations", url: "https://data.uspto.gov/apis/patent-file-wrapper/search", retrievedAt: new Date().toISOString(), names: uniqueCompanyNames(annotated) });
    }
    const candidateGroups = new Map<string, { representative: string; count: number }>();
    for (const candidate of discovery.facets["applicationMetaData.firstApplicantName"] ?? []) {
      if (!applicantNameMatches(candidate.value, nameDiscovery.searchedNames) || candidate.count <= 0) continue;
      // Case variants are covered by the same case-insensitive USPTO phrase.
      // Do not collapse Inc./LLC/Corp. or drop rare historical names.
      const rawKey = candidate.value.trim().toLowerCase();
      const existing = candidateGroups.get(rawKey);
      if (existing) existing.count += candidate.count;
      else candidateGroups.set(rawKey, { representative: candidate.value, count: candidate.count });
    }
    const rankedCandidates = [...candidateGroups.values()].sort((left, right) => right.count - left.count);
    const applicantCandidates = rankedCandidates.map((candidate) => ({ ...candidate, name: candidate.representative }));

    if (!applicantCandidates.length) {
      return {
        companyName,
        nameDiscovery,
        matchedApplicantNames: [],
        selectionRequired: false,
        applicantCandidates: [],
        identifiedGrantedPatents: 0,
        identifiedPendingApplications: 0,
        expiredInactivePatents: null,
        recentGrantCount: 0,
        activePatentCount: null,
        activePatentCountNote: "",
        filingTrends: [],
        grantTrends: [],
        topTechnologyAreas: [],
        recentApplications: [],
        recentGrants: [],
        coverage: {
          source: "USPTO Open Data Portal — Patent File Wrapper",
          retrievedAt: new Date().toISOString(),
          totalMatchesReported: 0,
          recordsAnalyzed: 0,
          resultLimit: 0,
          truncated: false,
          note: "No USPTO first-applicant name could be confidently matched to this search.",
        },
      };
    }

    if (!selectedApplicantNames?.length && (applicantCandidates.length > 1 || nameDiscovery.sources.length > 0 || additional.length > 0)) {
      return {
        companyName,
        nameDiscovery,
        matchedApplicantNames: [],
        selectionRequired: true,
        applicantCandidates,
        identifiedGrantedPatents: 0,
        identifiedPendingApplications: 0,
        expiredInactivePatents: null,
        recentGrantCount: 0,
        activePatentCount: null,
        activePatentCountNote: "",
        filingTrends: [],
        grantTrends: [],
        topTechnologyAreas: [],
        recentApplications: [],
        recentGrants: [],
        coverage: {
          source: "USPTO Open Data Portal — Patent File Wrapper",
          retrievedAt: new Date().toISOString(),
          totalMatchesReported: 0,
          recordsAnalyzed: 0,
          resultLimit: 0,
          truncated: false,
          note: "Select the applicant names to include before calculating portfolio metrics.",
        },
      };
    }
    const selectedSet = selectedApplicantNames?.length ? new Set(selectedApplicantNames) : new Set([applicantCandidates[0].representative]);
    if (selectedSet.size > 500) throw new PublicPatentToolError("Select up to 500 applicant names per analysis.", 400);
    const selectedCandidates = applicantCandidates.filter((candidate) => selectedSet.has(candidate.representative));
    if (selectedCandidates.length !== selectedSet.size) {
      throw new PublicPatentToolError("Choose one or more applicant names from the listed results.", 400);
    }

    const applicantQuery = applicantScopeQuery(selectedCandidates.map(c => c.representative));
    const query = `(${applicantQuery}) AND applicationMetaData.applicationTypeCategory:REGULAR`;
    const nowYear = new Date().getUTCFullYear();
    const firstTrendYear = nowYear - 4;
    const asOf = new Date();
    const recentGrantStart = new Date(asOf);
    recentGrantStart.setUTCFullYear(recentGrantStart.getUTCFullYear() - 1);
    const recentGrantQuery = `(${query}) AND applicationMetaData.patentNumber:* AND applicationMetaData.grantDate:[${recentGrantStart.toISOString().slice(0, 10)} TO *]`;
    const [summary, granted, recent, recentGrants, ...trendResults] = await Promise.all([
      requestAggregate(query, {
        facets: [
          "applicationMetaData.applicationStatusDescriptionText",
          "applicationMetaData.cpcClassificationBag",
        ],
      }),
      requestAggregate(`(${query}) AND applicationMetaData.patentNumber:*`, {
        facets: ["applicationMetaData.applicationStatusDescriptionText"],
      }),
      requestAggregate(`(${query}) AND applicationMetaData.earliestPublicationNumber:*`, { limit: 10 }),
      requestAggregate(recentGrantQuery, { limit: 20 }),
      ...Array.from({ length: 5 }, (_, index) => {
        const year = firstTrendYear + index;
        return requestAggregate(`(${query}) AND applicationMetaData.filingDate:[${year}-01-01 TO ${year}-12-31]`);
      }),
      ...Array.from({ length: 5 }, (_, index) => {
        const year = firstTrendYear + index;
        return requestAggregate(`(${query}) AND applicationMetaData.patentNumber:* AND applicationMetaData.grantDate:[${year}-01-01 TO ${year}-12-31]`);
      }),
    ]);

    const statusFacets = summary.facets["applicationMetaData.applicationStatusDescriptionText"] ?? [];
    const terminalMarkers = [
      "abandon",
      "expired",
      "patented case",
      "terminated",
      "withdrawn",
      "cancel",
      "revoked",
      "processing completed-placed in storage",
    ];
    const pendingCount = statusFacets
      .filter((entry) => {
        const status = entry.value.toLocaleLowerCase();
        return !terminalMarkers.some((marker) => status.includes(marker));
      })
      .reduce((sum, entry) => sum + entry.count, 0);
    const inactiveMarkers = ["expired", "lapsed", "revoked", "terminated"];
    const grantStatusFacets = granted.facets["applicationMetaData.applicationStatusDescriptionText"] ?? [];
    const expiredInactivePatents = grantStatusFacets.length
      ? grantStatusFacets
          .filter((entry) => inactiveMarkers.some((marker) => entry.value.toLocaleLowerCase().includes(marker)))
          .reduce((sum, entry) => sum + entry.count, 0)
      : null;
    const sections = new Map<string, number>();
    const classificationsBySection = new Map<string, Map<string, number>>();
    for (const entry of summary.facets["applicationMetaData.cpcClassificationBag"] ?? []) {
      const cpcCode = entry.value.trim();
      const section = cpcCode.charAt(0);
      if (!CPC_SECTIONS[section]) continue;
      sections.set(section, (sections.get(section) ?? 0) + entry.count);
      const sectionCodes = classificationsBySection.get(section) ?? new Map<string, number>();
      sectionCodes.set(cpcCode, (sectionCodes.get(cpcCode) ?? 0) + entry.count);
      classificationsBySection.set(section, sectionCodes);
    }

    const recentApplications = recent.records
      .filter((record) => text(metadata(record).earliestPublicationNumber))
      .sort((left, right) => (text(metadata(right).earliestPublicationDate) ?? "").localeCompare(text(metadata(left).earliestPublicationDate) ?? ""))
      .slice(0, 5)
      .map((record) => {
        const meta = metadata(record);
        const applicationNumber = text(record.applicationNumberText) ?? "";
        return {
          applicationNumber,
          title: text(meta.inventionTitle) ?? "Title unavailable",
          filingDate: text(meta.filingDate),
          publicationNumber: text(meta.earliestPublicationNumber),
          publicationDate: text(meta.earliestPublicationDate),
          status: text(meta.applicationStatusDescriptionText) ?? "Status unavailable",
          url: `https://patentcenter.uspto.gov/applications/${applicationNumber}`,
        };
      });

    const recentGrantRecords = recentGrants.records
      .filter((record) => text(metadata(record).patentNumber))
      .sort((left, right) => (text(metadata(right).grantDate) ?? "").localeCompare(text(metadata(left).grantDate) ?? ""))
      .slice(0, 20)
      .map((record) => {
        const meta = metadata(record);
        const applicationNumber = text(record.applicationNumberText) ?? "";
        const firstCpc = stringArray(meta.cpcClassificationBag)[0]?.trim().charAt(0) ?? "";
        return {
          patentNumber: text(meta.patentNumber) ?? "",
          title: text(meta.inventionTitle) ?? "Title unavailable",
          grantDate: text(meta.grantDate),
          technologyArea: CPC_SECTIONS[firstCpc] ?? "Unclassified",
          applicationNumber,
          url: `https://patentcenter.uspto.gov/applications/${applicationNumber}`,
        };
      });

    return {
      companyName,
      nameDiscovery,
      matchedApplicantNames: selectedCandidates.map((candidate) => candidate.representative),
      selectionRequired: false,
      applicantCandidates,
      identifiedGrantedPatents: granted.count,
      identifiedPendingApplications: pendingCount,
      expiredInactivePatents,
      recentGrantCount: recentGrants.count,
      activePatentCount: null,
      activePatentCountNote: "",
      filingTrends: trendResults.slice(0, 5).map((result, index) => ({ year: firstTrendYear + index, count: result.count })),
      grantTrends: trendResults.slice(5).map((result, index) => ({ year: firstTrendYear + index, count: result.count })),
      topTechnologyAreas: [...sections]
        .map(([code, count]) => ({
          code,
          label: CPC_SECTIONS[code],
          count,
          classifications: [...(classificationsBySection.get(code) ?? new Map())]
            .map(([classificationCode, classificationCount]) => ({ code: classificationCode, count: classificationCount }))
            .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
            .slice(0, 12),
        }))
        .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
        .slice(0, 5),
      recentApplications,
      recentGrants: recentGrantRecords,
      coverage: {
        source: "USPTO Open Data Portal — Patent File Wrapper",
        retrievedAt: new Date().toISOString(),
        totalMatchesReported: summary.count,
        recordsAnalyzed: summary.count,
        resultLimit: 0,
        truncated: false,
        note: "Counts and charts use complete USPTO aggregations for the matched first-applicant names; five recent published applications are shown as detail. Assignment-only ownership changes may not appear.",
      },
    };
  });
}

export async function fetchFirmApplicationPage(customer: number, offset: number) {
  const url = new URL(`${USPTO_API_BASE}${SEARCH_PATH}`);
  url.searchParams.set("q", `applicationMetaData.customerNumber:${customer}`);
  url.searchParams.set("limit", "100"); url.searchParams.set("offset", String(offset));
  url.searchParams.set("fields", "applicationNumberText,applicationMetaData,correspondenceAddressBag,eventDataBag");
  const response = await requestUspto(url);
  if (response.status === 404) return { count: 0, records: [] as JsonRecord[] };
  if (!response.ok) throw new Error(`USPTO firm-data request failed (${response.status})`);
  const body = asRecord(await response.json()) ?? {};
  if (typeof body.count !== "number" || !Array.isArray(body.patentFileWrapperDataBag)) {
    throw new Error("USPTO returned an invalid firm-data page");
  }
  return { count: body.count, records: recordsFrom(body.patentFileWrapperDataBag) };
}

export async function analyzePortfolioAdvanced(selectedApplicantNames: string[]) {
  const names = [...new Set(selectedApplicantNames.map((name) => name.trim()).filter((name) => name.length >= 2 && name.length <= 200))];
  if (!names.length || names.length > 500 || names.length !== selectedApplicantNames.length) {
    throw new PublicPatentToolError("Select one or more valid applicant names first.", 400);
  }
  const selectedKey = JSON.stringify(names.slice().sort());
  const snapshot = await firmSnapshot();
  return cached(`portfolio-advanced-full-range-counsel-v3:${snapshot.updatedAt ?? "none"}:${selectedKey}`, async () => {
    const applicantQuery = applicantScopeQuery(names);
    const query = `(${applicantQuery}) AND applicationMetaData.applicationTypeCategory:REGULAR`;
    const aggregate = await requestAggregate(query, { facets: [STATUS_FACET, "applicationMetaData.groupArtUnitNumber"] });
    const sample = await requestSearch(
        query,
        `applicationNumberText,applicationMetaData,${COUNSEL_SEARCH_FIELDS},eventDataBag`,
        { total: aggregate.count },
    );
    const sampleByApplication = new Map<string, JsonRecord>();
    for (const record of sample.records) {
      const applicationNumber = text(record.applicationNumberText);
      if (applicationNumber) sampleByApplication.set(applicationNumber, record);
    }
    const records = [...sampleByApplication.values()];
    const normalizedRecords = records.map(metricApplication);
    const sharedMetrics = calculatePortfolioMetrics(normalizedRecords);
    const outsideCounsel = analyzePortfolioCounsel(records, names);
    const recordsWithHistory = records.filter((record) => metricApplication(record).hasHistory);
    const historyStartDates = normalizedRecords
      .map(record => record.filingDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    const eventDateRange = historyStartDates.length
      ? { start: historyStartDates[0], end: historyStartDates.at(-1)! }
      : null;

    const averageOfficeActions = sharedMetrics.officeActionsPerPatent.value === null ? null : round(sharedMetrics.officeActionsPerPatent.value, 2);

    const terminalMarkers = [
      "abandon", "expired", "patented case", "terminated", "withdrawn", "cancel",
      "revoked", "processing completed-placed in storage",
    ];
    const pendingWithDates = records.filter((record) => {
      const meta = metadata(record);
      const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
      return !isGranted(meta) && !isAbandoned(meta) &&
        !isAllowedStatus(status) &&
        !terminalMarkers.some((marker) => status.includes(marker)) &&
        Boolean(text(meta.filingDate));
    }).flatMap((record) => {
      const filingDate = text(metadata(record).filingDate)!;
      const ageMonths = monthsBetween(filingDate, new Date().toISOString());
      return ageMonths === null ? [] : [{ filingDate, ageYears: ageMonths / 12 }];
    });
    const pendingAgeBuckets = [
      { label: "Under 1 year", count: pendingWithDates.filter((item) => item.ageYears < 1).length },
      { label: "1–3 years", count: pendingWithDates.filter((item) => item.ageYears >= 1 && item.ageYears < 3).length },
      { label: "3–5 years", count: pendingWithDates.filter((item) => item.ageYears >= 3 && item.ageYears < 5).length },
      { label: "Over 5 years", count: pendingWithDates.filter((item) => item.ageYears >= 5).length },
    ];
    const pendingAgeAverage = pendingWithDates.length >= 10
      ? round(pendingWithDates.reduce((sum, item) => sum + item.ageYears, 0) / pendingWithDates.length, 2)
      : null;

    const examinerApplications = new Map<string, Map<string, { count: number; artUnits: Map<string, number> }>>();
    for (const record of records) {
      const meta = metadata(record);
      const examiner = text(meta.examinerNameText);
      const applicationNumber = text(record.applicationNumberText);
      const artUnit = text(meta.groupArtUnitNumber);
      if (!examiner || !applicationNumber || !artUnit || !/^\d{4}$/.test(artUnit) || /\b(docket|central)\b/i.test(examiner)) continue;
      const apps = examinerApplications.get(examiner) ?? new Map();
      const entry = apps.get(applicationNumber) ?? { count: 0, artUnits: new Map<string, number>() };
      entry.count = 1;
      entry.artUnits.set(artUnit, (entry.artUnits.get(artUnit) ?? 0) + 1);
      apps.set(applicationNumber, entry);
      examinerApplications.set(examiner, apps);
    }
    const topExaminers = [...examinerApplications].map(([examinerName, apps]) => {
      const artUnitCounts = new Map<string, number>();
      for (const entry of apps.values()) {
        for (const [artUnit, count] of entry.artUnits) artUnitCounts.set(artUnit, (artUnitCounts.get(artUnit) ?? 0) + count);
      }
      return {
        examinerName,
        artUnit: [...artUnitCounts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null,
        applicationCount: apps.size,
      };
    }).sort((left, right) => right.applicationCount - left.applicationCount || left.examinerName.localeCompare(right.examinerName)).slice(0, 5);

    const artUnitFacets = aggregate.facets["applicationMetaData.groupArtUnitNumber"] ?? [];
    const topArtUnits = artUnitFacets
      .filter((facet) => /^\d{4}$/.test(facet.value))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
      .slice(0, 5)
      .map((facet) => ({
        artUnit: facet.value,
        applicationCount: facet.count,
        portfolioSharePercent: aggregate.count ? round((facet.count / aggregate.count) * 100) : 0,
      }));
    const samplePendingAges = pendingAgeBuckets.map((bucket) => ({
      ...bucket,
      sharePercent: pendingWithDates.length ? round((bucket.count / pendingWithDates.length) * 100) : 0,
    }));

    return {
      firmBenchmark: computeFirmBenchmark(normalizedRecords, snapshot.records, snapshot.updatedAt, names),
      prosecutionEfficiency: {
        applicationsWithHistories: recordsWithHistory.length,
        averageOfficeActionsPerGrantedPatent: averageOfficeActions,
        officeActionDenominator: sharedMetrics.officeActionsPerPatent.denominator,
        rceRate: sharedMetrics.rceRate.value === null ? null : round(sharedMetrics.rceRate.value),
        rceApplications: sharedMetrics.rceRate.numerator,
        rceDenominator: sharedMetrics.rceRate.denominator,
        examinerInterviewRate: sharedMetrics.interviewRate.value === null ? null : round(sharedMetrics.interviewRate.value),
        interviewApplications: sharedMetrics.interviewRate.numerator,
        interviewDenominator: sharedMetrics.interviewRate.denominator,
        allowedWithTwoOrFewerActionsRate: sharedMetrics.allowedWithTwoActionsRate.value === null ? null : round(sharedMetrics.allowedWithTwoActionsRate.value),
        allowedWithTwoOrFewerActions: sharedMetrics.allowedWithTwoActionsRate.numerator,
        allowedWithHistory: sharedMetrics.allowedWithTwoActionsRate.denominator,
        filingDateStart: eventDateRange?.start ?? null,
        filingDateEnd: eventDateRange?.end ?? null,
      },
      topArtUnits,
      outsideCounsel,
      portfolioInsights: {
        overallAllowanceRate: sharedMetrics.allowanceRate.value === null ? null : round(sharedMetrics.allowanceRate.value),
        knownFinalOutcomes: sharedMetrics.allowanceRate.denominator,
        averageTimeToGrantMonths: sharedMetrics.timeToGrantYears.value === null ? null : round(sharedMetrics.timeToGrantYears.value * 12, 1),
        grantDurationSampleSize: sharedMetrics.timeToGrantYears.denominator,
        averagePendingAgeYears: pendingAgeAverage,
        pendingAgeSampleSize: pendingWithDates.length,
        pendingAgeBuckets: samplePendingAges,
        topExaminers,
        examinerSampleSize: records.length,
      },
      coverage: {
        source: "USPTO Open Data Portal — Patent File Wrapper",
        retrievedAt: new Date().toISOString(),
        totalMatchesReported: sample.count,
        recordsAnalyzed: records.length,
        resultLimit: RESULT_LIMIT,
        truncated: sample.truncated,
        note: `Advanced prosecution metrics use ${recordsWithHistory.length} of ${records.length} distinct application records with non-empty event histories${sample.truncated ? ` from a capped ${RESULT_LIMIT.toLocaleString()}-record systematic block sample spread across all ${sample.count.toLocaleString()} returned results, not just the newest filings. This is not a random sample` : "; all matching records were retrieved"}. Empty or missing histories are excluded from event-based denominators. Filing date range: ${eventDateRange ? `${eventDateRange.start} to ${eventDateRange.end}` : "unavailable"}.`,
      },
    };
  });
}

function examinerQuery(input: string, selectedExaminerName?: string) {
  const query = input.trim().replace(/\s+/g, " ");
  if (/^\d{4}$/.test(query)) {
    return { searchType: "art-unit" as const, value: query, query: `applicationMetaData.groupArtUnitNumber:${query}` };
  }
  const normalized = (selectedExaminerName ?? query).toLocaleUpperCase();
  const formatted = normalized.includes(",")
    ? normalized
    : (() => {
        const parts = normalized.split(" ");
        return parts.length > 1 ? `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}` : normalized;
      })();
  return {
    searchType: "examiner" as const,
    value: formatted,
    query: `applicationMetaData.examinerNameText:"${escapeQuery(formatted)}"`,
  };
}

function normalizeApplicationNumber(input: string) {
  const compact = input.trim().replace(/[\s,.-]/g, "");
  if (/^\d{8}$/.test(compact)) return `${compact.slice(0, 2)}/${compact.slice(2)}`;
  if (/^\d{2}\/\d{6}$/.test(input.trim())) return input.trim();
  return null;
}

function isAllowed(record: JsonRecord) {
  const meta = metadata(record);
  const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
  if (isGranted(meta) || isAllowedStatus(status)) return true;
  return events(record).some((event) => (text(event.eventDescriptionText)?.toLocaleLowerCase() ?? "").includes("notice of allowance"));
}

function events(record: JsonRecord) {
  return Array.isArray(record.eventDataBag)
    ? record.eventDataBag.filter((item): item is JsonRecord => Boolean(asRecord(item)))
    : [];
}

async function analyzeExaminerProfile(queryInput: string, selectedExaminerName?: string) {
  const parsed = examinerQuery(queryInput, selectedExaminerName);
  if (parsed.searchType === "examiner" && parsed.value.length < 3) {
    throw new PublicPatentToolError("Enter an examiner's full name or a four-digit art unit.", 400);
  }

  return cached(`examiner-independent-rates:${RCE_CALCULATION_VERSION}:${parsed.searchType}:${parsed.value}:${selectedExaminerName ?? ""}`, async () => {
    const search = await requestSearch(
      parsed.query,
      "applicationNumberText,applicationMetaData,eventDataBag,childContinuityBag",
    );
    const allowed = search.records.filter(isAllowed);
    const abandoned = search.records.filter((record) => isAbandoned(metadata(record)));
    const disposed = allowed.length + abandoned.length;
    const completeCoverage = !search.truncated;
    const durationValues = allowed.flatMap((record) => {
      const meta = metadata(record);
      const duration = monthsBetween(text(meta.filingDate) ?? "", text(meta.grantDate) ?? "");
      return duration === null ? [] : [duration];
    });
    const examinerCounts = new Map<string, number>();
    const artUnitCounts = new Map<string, number>();
    for (const record of search.records) {
      const meta = metadata(record);
      const examiner = text(meta.examinerNameText);
      const artUnit = text(meta.groupArtUnitNumber);
      if (examiner) examinerCounts.set(examiner, (examinerCounts.get(examiner) ?? 0) + 1);
      if (artUnit) artUnitCounts.set(artUnit, (artUnitCounts.get(artUnit) ?? 0) + 1);
    }
    const topExaminers = [...examinerCounts]
      .map(([examinerName, count]) => ({ examinerName, count }))
      .sort((left, right) => right.count - left.count || left.examinerName.localeCompare(right.examinerName))
      .slice(0, 5);
    if (parsed.searchType === "examiner" && !selectedExaminerName && topExaminers.length > 1) {
      return {
        query: queryInput.trim(),
        searchType: parsed.searchType,
        examinerName: null,
        artUnit: null,
        identifiedApplications: search.count,
        disposedApplications: 0,
        allowedApplications: 0,
        abandonedApplications: 0,
        estimatedAllowanceRate: null,
        averageProsecutionDurationMonths: null,
        selectionRequired: true,
        examinerCandidates: topExaminers,
        topExaminers: [],
        calculationNote: "Choose the examiner you intended to look up.",
        coverage: {
          source: "USPTO Open Data Portal — Patent File Wrapper",
          retrievedAt: new Date().toISOString(),
          totalMatchesReported: search.count,
          recordsAnalyzed: search.records.length,
          resultLimit: RESULT_LIMIT,
          truncated: search.truncated,
          note: "Select an examiner from the matching USPTO names before calculating metrics.",
        },
      };
    }
    const primaryArtUnit = [...artUnitCounts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const primaryExaminer = topExaminers[0]?.examinerName ?? null;
    const roleEvidence = parsed.searchType === "examiner" && primaryExaminer
      ? await findExaminerRole(primaryExaminer, search.records.flatMap((record) => {
        const applicationNumber = text(record.applicationNumberText);
        const grantDate = text(metadata(record).grantDate);
        return applicationNumber && grantDate ? [{ applicationNumber, grantDate, examinerName: text(metadata(record).examinerNameText) ?? undefined }] : [];
      }), requestUspto, { discoverHistorical: true })
      : undefined;
    const rceContinuationJobId = parsed.searchType === "examiner" && primaryExaminer
      ? await queueExaminerRateJob(primaryExaminer, search.records, requestUspto).catch(error => {
        logger.error({ err: error }, "Could not start independent examiner rate analysis");
        return undefined;
      }) : undefined;
    const benchmarkArtUnit = parsed.searchType === "art-unit" ? parsed.value : primaryArtUnit;
    const technologyCenter = benchmarkArtUnit && /^\d{4}$/.test(benchmarkArtUnit) ? `${benchmarkArtUnit.slice(0, 2)}00` : null;
    const technologyCenterEnd = technologyCenter ? `${technologyCenter.slice(0, 2)}99` : null;
    const [examinerStatusAggregate, artUnitStatusAggregate, technologyCenterStatusAggregate] = await Promise.all([
      parsed.searchType === "examiner"
        ? requestAggregate(parsed.query, { facets: [STATUS_FACET] })
        : Promise.resolve(null),
      benchmarkArtUnit && /^\d{4}$/.test(benchmarkArtUnit)
        ? requestAggregate(`applicationMetaData.groupArtUnitNumber:${benchmarkArtUnit}`, { facets: [STATUS_FACET] })
        : Promise.resolve(null),
      technologyCenter && technologyCenterEnd
        ? requestAggregate(`applicationMetaData.groupArtUnitNumber:[${technologyCenter} TO ${technologyCenterEnd}]`, { facets: [STATUS_FACET] })
        : Promise.resolve(null),
    ]);
    const examinerOutcome = examinerStatusAggregate ? dispositionCounts(examinerStatusAggregate.facets) : null;
    const artUnitOutcome = artUnitStatusAggregate ? dispositionCounts(artUnitStatusAggregate.facets) : null;
    const technologyCenterOutcome = technologyCenterStatusAggregate ? dispositionCounts(technologyCenterStatusAggregate.facets) : null;
    const primaryOutcome = parsed.searchType === "art-unit" ? artUnitOutcome : examinerOutcome;
    const recordsWithEventData = search.records.filter((record) => Array.isArray(record.eventDataBag));
    const officeActionCounts = recordsWithEventData.map((record) => {
      const actionEvents = events(record);
      return {
        nonFinal: actionEvents.filter((event) => text(event.eventCode) === "CTNF").length,
        final: actionEvents.filter((event) => text(event.eventCode) === "CTFR").length,
        restriction: actionEvents.some((event) => text(event.eventCode) === "CTRS"),
        firstActionDate: actionEvents
          .filter((event) => ["CTNF", "CTFR"].includes(text(event.eventCode) ?? ""))
          .map((event) => text(event.eventDate))
          .filter((date): date is string => Boolean(date))
          .sort()[0] ?? null,
      };
    });
    const firstActionMonths = recordsWithEventData.flatMap((record, index) => {
      const filingDate = text(metadata(record).filingDate);
      const firstActionDate = officeActionCounts[index]?.firstActionDate;
      const months = filingDate && firstActionDate ? monthsBetween(filingDate, firstActionDate) : null;
      return months === null ? [] : [months];
    });
    const interviewGroups = { withSummary: { total: 0, allowed: 0, abandoned: 0 }, withoutSummary: { total: 0, allowed: 0, abandoned: 0 } };
    for (const record of recordsWithEventData) {
      const hasInterviewSummary = events(record).some((event) => ["EXIN", "EXAT", "EXET"].includes(text(event.eventCode) ?? ""));
      const group = hasInterviewSummary ? interviewGroups.withSummary : interviewGroups.withoutSummary;
      group.total += 1;
      if (isAllowed(record)) group.allowed += 1;
      else if (isAbandoned(metadata(record))) group.abandoned += 1;
    }

    return {
      query: queryInput.trim(),
      searchType: parsed.searchType,
      examinerName: parsed.searchType === "examiner" ? primaryExaminer : null,
      artUnit: parsed.searchType === "art-unit" ? parsed.value : primaryArtUnit,
      identifiedApplications: search.count,
      disposedApplications: primaryOutcome?.hasStatusData ? primaryOutcome.disposed : completeCoverage ? disposed : 0,
      allowedApplications: primaryOutcome?.hasStatusData ? primaryOutcome.allowed : completeCoverage ? allowed.length : 0,
      abandonedApplications: primaryOutcome?.hasStatusData ? primaryOutcome.abandoned : completeCoverage ? abandoned.length : 0,
      estimatedAllowanceRate: primaryOutcome?.hasStatusData
        ? (primaryOutcome.disposed >= 10 ? primaryOutcome.allowanceRate : null)
        : completeCoverage && disposed >= 10 ? round((allowed.length / disposed) * 100) : null,
      averageProsecutionDurationMonths: completeCoverage && durationValues.length >= 10
        ? round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
        : null,
      selectionRequired: false,
      examinerCandidates: [],
      topExaminers: parsed.searchType === "art-unit" ? topExaminers : [],
      roleEvidence,
      rceContinuationJobId,
      allowanceBenchmarks: {
        examinerAllowanceRate: (parsed.searchType === "examiner" ? examinerOutcome : artUnitOutcome)?.allowanceRate ?? null,
        artUnitAllowanceRate: artUnitOutcome?.allowanceRate ?? null,
        technologyCenterAllowanceRate: technologyCenterOutcome?.allowanceRate ?? null,
        artUnit: benchmarkArtUnit,
        technologyCenter,
        artUnitApplications: artUnitStatusAggregate?.count ?? 0,
        technologyCenterApplications: technologyCenterStatusAggregate?.count ?? 0,
        artUnitDisposedApplications: artUnitOutcome?.disposed ?? 0,
        technologyCenterDisposedApplications: technologyCenterOutcome?.disposed ?? 0,
        calculationNote: "All rates use USPTO current-status facets and allowed ÷ (allowed + abandoned). Benchmarks include the examiner when present; percentiles are unavailable from the returned USPTO aggregates.",
      },
      officeActionAnalytics: recordsWithEventData.length ? {
        ...calculateExaminerBehaviorMetrics(search.records),
        applicationsWithEventData: recordsWithEventData.length,
        applicationsWithOfficeAction: officeActionCounts.filter((item) => item.nonFinal + item.final > 0).length,
        applicationsWithFinalRejection: officeActionCounts.filter((item) => item.final > 0).length,
        applicationsWithRestriction: officeActionCounts.filter((item) => item.restriction).length,
        averageNonFinalActionsPerApplication: round(officeActionCounts.reduce((sum, item) => sum + item.nonFinal, 0) / recordsWithEventData.length),
        averageFinalActionsPerApplication: round(officeActionCounts.reduce((sum, item) => sum + item.final, 0) / recordsWithEventData.length),
        medianMonthsFilingToFirstAction: median(firstActionMonths),
      } : undefined,
      interviewAnalytics: recordsWithEventData.length ? {
        applicationsWithEventData: recordsWithEventData.length,
        applicationsWithInterviewSummary: interviewGroups.withSummary.total,
        interviewSummaryAllowed: interviewGroups.withSummary.allowed,
        interviewSummaryAbandoned: interviewGroups.withSummary.abandoned,
        interviewSummaryOther: interviewGroups.withSummary.total - interviewGroups.withSummary.allowed - interviewGroups.withSummary.abandoned,
        applicationsWithoutInterviewSummary: interviewGroups.withoutSummary.total,
        noSummaryAllowed: interviewGroups.withoutSummary.allowed,
        noSummaryAbandoned: interviewGroups.withoutSummary.abandoned,
        noSummaryOther: interviewGroups.withoutSummary.total - interviewGroups.withoutSummary.allowed - interviewGroups.withoutSummary.abandoned,
      } : undefined,
      calculationNote: primaryOutcome?.hasStatusData
        ? "Allowance rate uses complete USPTO current-status facets: allowed ÷ (allowed + abandoned). Pending applications are excluded. Event-history metrics use the retrieved records shown in coverage."
        : completeCoverage
          ? "Allowance rate uses identified allowed or patented cases divided by identified allowed, patented, and abandoned cases."
          : `The USPTO reported more than ${RESULT_LIMIT.toLocaleString()} matching applications. Outcome metrics are withheld because complete status facets were unavailable.`,
      coverage: {
        source: "USPTO Open Data Portal — Patent File Wrapper",
        retrievedAt: new Date().toISOString(),
        totalMatchesReported: search.count,
        recordsAnalyzed: search.records.length,
        resultLimit: RESULT_LIMIT,
        truncated: search.truncated,
        note: "Statistics reflect public application records returned by the USPTO. Examiner identity and art-unit assignments can change during prosecution.",
      },
    };
  });
}

export async function analyzeExaminer(queryInput: string, selectedExaminerName?: string) {
  const applicationNumber = normalizeApplicationNumber(queryInput);
  if (!applicationNumber) return analyzeExaminerProfile(queryInput, selectedExaminerName);

  return cached(`examiner-application:${applicationNumber}`, async () => {
    const application = await requestSearch(
      `applicationNumberText:"${applicationNumber.replace("/", "")}"`,
      "applicationNumberText,applicationMetaData,eventDataBag",
    );
    const record = application.records[0];
    if (!record) throw new PublicPatentToolError(`No USPTO application was found for ${applicationNumber}.`, 404);
    const examinerName = text(metadata(record).examinerNameText);
    const artUnit = text(metadata(record).groupArtUnitNumber);
    if (!examinerName || !artUnit || !/^\d{4}$/.test(artUnit)) {
      throw new PublicPatentToolError(`The USPTO has not assigned a named examiner to application ${applicationNumber} yet.`, 422);
    }

    const profile = await analyzeExaminerProfile(examinerName, examinerName);
    return {
      ...profile,
      query: queryInput.trim(),
      applicationNumberContext: applicationNumber,
      calculationNote: `${profile.calculationNote} This profile uses the examiner currently listed for application ${applicationNumber}; earlier prosecution may involve another examiner.`,
    };
  });
}
