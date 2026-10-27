const USPTO_API_BASE = "https://api.uspto.gov";
const SEARCH_PATH = "/api/v1/patent/applications/search";
const RESULT_LIMIT = 2000;
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

type SearchResult = {
  count: number;
  records: JsonRecord[];
  truncated: boolean;
};

type CachedValue = {
  expiresAt: number;
  value: unknown;
};

const resultCache = new Map<string, CachedValue>();

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

async function requestSearch(query: string, fields: string): Promise<SearchResult> {
  const records: JsonRecord[] = [];
  let count = 0;

  for (let offset = 0; offset < RESULT_LIMIT; offset += PAGE_SIZE) {
    const url = new URL(`${USPTO_API_BASE}${SEARCH_PATH}`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("fields", fields);
    const response = await fetch(url, {
      headers: { Accept: "application/json", "X-API-KEY": apiKey() },
      signal: AbortSignal.timeout(30_000),
    });
    const bodyText = await response.text();
    let body: JsonRecord = {};
    try {
      body = asRecord(bodyText ? JSON.parse(bodyText) : {}) ?? {};
    } catch {
      body = {};
    }
    if (response.status === 404) return { count: 0, records: [], truncated: false };
    if (!response.ok) {
      const detail = text(body.detailedMessage) ?? text(body.message);
      const status = response.status >= 400 && response.status < 500 ? 400 : 502;
      throw new PublicPatentToolError(detail ?? `USPTO request failed with status ${response.status}.`, status);
    }

    count = numberValue(body.count);
    const page = Array.isArray(body.patentFileWrapperDataBag)
      ? body.patentFileWrapperDataBag.filter((item): item is JsonRecord => Boolean(asRecord(item)))
      : [];
    records.push(...page);
    if (page.length < PAGE_SIZE || records.length >= count) break;
  }

  return { count, records, truncated: count > records.length };
}

async function cached<T>(key: string, load: () => Promise<T>) {
  const entry = resultCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;
  const value = await load();
  resultCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (resultCache.size > 100) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
  return value;
}

function applicantNames(meta: JsonRecord) {
  const names = new Set<string>();
  const first = text(meta.firstApplicantName);
  if (first) names.add(first);
  if (Array.isArray(meta.applicantBag)) {
    for (const applicant of meta.applicantBag) {
      const name = text(asRecord(applicant)?.applicantNameText);
      if (name) names.add(name);
    }
  }
  return [...names];
}

function isGranted(meta: JsonRecord) {
  const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
  return Boolean(text(meta.patentNumber) || text(meta.grantDate) || status.includes("patented case"));
}

function isAbandoned(meta: JsonRecord) {
  return (text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "").includes("abandon");
}

function isPending(meta: JsonRecord) {
  const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
  return !isGranted(meta) && !isAbandoned(meta) && !status.includes("terminated") && !status.includes("cancel");
}

export async function analyzePortfolio(companyNameInput: string) {
  const companyName = companyNameInput.trim().replace(/\s+/g, " ");
  const normalizedCompany = normalizeOrganization(companyName);
  if (normalizedCompany.length < 2) throw new PublicPatentToolError("Enter a more specific company name.", 400);

  return cached(`portfolio:${normalizedCompany}`, async () => {
    const query = `applicationMetaData.firstApplicantName:"${escapeQuery(companyName)}"`;
    const search = await requestSearch(
      query,
      "applicationNumberText,applicationMetaData",
    );
    const exactOrganizationMatchExists = search.records.some((record) => applicantNames(metadata(record)).some(
      (name) => normalizeOrganization(name) === normalizedCompany,
    ));
    const matchesOrganization = (name: string) => {
      const normalizedName = normalizeOrganization(name);
      if (exactOrganizationMatchExists) return normalizedName === normalizedCompany;
      return normalizedName.startsWith(`${normalizedCompany} `) || normalizedCompany.startsWith(`${normalizedName} `);
    };
    const matched = search.records.filter((record) => applicantNames(metadata(record)).some(matchesOrganization));
    const matchedNames = [...new Set(
      matched.flatMap((record) => applicantNames(metadata(record))).filter(matchesOrganization),
    )].sort();
    const nowYear = new Date().getUTCFullYear();
    const firstTrendYear = nowYear - 4;
    const trends = new Map<number, number>();
    for (let year = firstTrendYear; year <= nowYear; year += 1) trends.set(year, 0);
    const sections = new Map<string, number>();

    for (const record of matched) {
      const meta = metadata(record);
      const filingYear = Number(text(meta.filingDate)?.slice(0, 4));
      if (trends.has(filingYear)) trends.set(filingYear, (trends.get(filingYear) ?? 0) + 1);
      const uniqueSections = new Set(stringArray(meta.cpcClassificationBag).map((code) => code.trim().charAt(0)).filter((code) => CPC_SECTIONS[code]));
      for (const section of uniqueSections) sections.set(section, (sections.get(section) ?? 0) + 1);
    }

    const recentApplications = matched
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

    return {
      companyName,
      matchedApplicantNames: matchedNames.slice(0, 12),
      identifiedGrantedPatents: matched.filter((record) => isGranted(metadata(record))).length,
      identifiedPendingApplications: matched.filter((record) => isPending(metadata(record))).length,
      activePatentCount: null,
      activePatentCountNote: "The USPTO application record does not establish whether maintenance fees are current, so active-patent status is not inferred.",
      filingTrends: [...trends].map(([year, count]) => ({ year, count })),
      topTechnologyAreas: [...sections]
        .map(([code, count]) => ({ code, label: CPC_SECTIONS[code], count }))
        .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
        .slice(0, 5),
      recentApplications,
      coverage: {
        source: "USPTO Open Data Portal — Patent File Wrapper",
        retrievedAt: new Date().toISOString(),
        totalMatchesReported: search.count,
        recordsAnalyzed: matched.length,
        resultLimit: RESULT_LIMIT,
        truncated: search.truncated,
        note: "Results include published U.S. applications whose returned applicant name matched the search. Ownership changes recorded only in assignment data may not appear.",
      },
    };
  });
}

function examinerQuery(input: string) {
  const query = input.trim().replace(/\s+/g, " ");
  if (/^\d{4}$/.test(query)) {
    return { searchType: "art-unit" as const, value: query, query: `applicationMetaData.groupArtUnitNumber:${query}` };
  }
  const normalized = query.toLocaleUpperCase();
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

function isAllowed(record: JsonRecord) {
  const meta = metadata(record);
  const status = text(meta.applicationStatusDescriptionText)?.toLocaleLowerCase() ?? "";
  if (isGranted(meta) || status.includes("issue fee") || status.includes("allowance")) return true;
  return events(record).some((event) => (text(event.eventDescriptionText)?.toLocaleLowerCase() ?? "").includes("notice of allowance"));
}

function events(record: JsonRecord) {
  return Array.isArray(record.eventDataBag)
    ? record.eventDataBag.filter((item): item is JsonRecord => Boolean(asRecord(item)))
    : [];
}

function officeActionCount(record: JsonRecord) {
  return events(record).filter((event) => {
    const description = text(event.eventDescriptionText)?.toLocaleLowerCase() ?? "";
    return description.includes("non final action mailed") || description.includes("final rejection mailed");
  }).length;
}

export async function analyzeExaminer(queryInput: string) {
  const parsed = examinerQuery(queryInput);
  if (parsed.searchType === "examiner" && parsed.value.length < 3) {
    throw new PublicPatentToolError("Enter an examiner's full name or a four-digit art unit.", 400);
  }

  return cached(`examiner:${parsed.searchType}:${parsed.value}`, async () => {
    const search = await requestSearch(
      parsed.query,
      "applicationNumberText,applicationMetaData,eventDataBag",
    );
    const allowed = search.records.filter(isAllowed);
    const abandoned = search.records.filter((record) => isAbandoned(metadata(record)));
    const disposed = allowed.length + abandoned.length;
    const completeCoverage = !search.truncated;
    const officeActionValues = allowed.map(officeActionCount);
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
    const primaryArtUnit = [...artUnitCounts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const primaryExaminer = topExaminers[0]?.examinerName ?? null;

    return {
      query: queryInput.trim(),
      searchType: parsed.searchType,
      examinerName: parsed.searchType === "examiner" ? primaryExaminer : null,
      artUnit: parsed.searchType === "art-unit" ? parsed.value : primaryArtUnit,
      identifiedApplications: search.count,
      disposedApplications: completeCoverage ? disposed : 0,
      allowedApplications: completeCoverage ? allowed.length : 0,
      abandonedApplications: completeCoverage ? abandoned.length : 0,
      estimatedAllowanceRate: completeCoverage && disposed >= 10 ? round((allowed.length / disposed) * 100) : null,
      averageOfficeActionsBeforeAllowance: completeCoverage && officeActionValues.length >= 10 && officeActionValues.some((value) => value > 0)
        ? round(officeActionValues.reduce((sum, value) => sum + value, 0) / officeActionValues.length)
        : null,
      averageProsecutionDurationMonths: completeCoverage && durationValues.length >= 10
        ? round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
        : null,
      topExaminers: parsed.searchType === "art-unit" ? topExaminers : [],
      calculationNote: completeCoverage
        ? "Allowance rate uses identified allowed or patented cases divided by identified allowed, patented, and abandoned cases. Office Actions count mailed non-final actions and final rejections in the public event history."
        : `The USPTO reported more than ${RESULT_LIMIT.toLocaleString()} matching applications. Outcome metrics are withheld because the analyzed records are an incomplete sample.`,
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
