import type { PublicPortfolioAdvancedAnalysisOutsideCounsel } from "@workspace/api-zod";

type Row = Record<string, unknown>;
const object = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(object) : [];
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";

export function counselNameKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\br[\s.]*l[\s.]*l[\s.]*p\b/g, "rllp")
    .replace(/\bl[\s.]*l[\s.]*p\b/g, "llp").replace(/\bp[\s.]*l[\s.]*l[\s.]*c\b/g, "pllc")
    .replace(/\bp[\s.]*c\b/g, "pc").replace(/\bp[\s.]*a\b/g, "pa")
    .replace(/\bp[\s.]*s\b/g, "ps")
    .replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
const identityKey = (v: string) => counselNameKey(v).replace(/\s+(?:rllp|llp|pllc|llc|pc|pa|ps|inc|incorporated|corp|corporation|ltd|limited)$/, "").trim();
const hasFirmDesignation = (v: string) => /\b(?:rllp|llp|pllc|pc|pa|ps|law|legal|attorneys?)\b/.test(counselNameKey(v))
  || (/\b(?:llc|inc|corporation)\b/.test(counselNameKey(v)) && /\b(?:ip|patent|intellectual property)\b/.test(counselNameKey(v)));
const addressNames = (addresses: Row[]) => addresses.flatMap(a => [text(a.nameLineOneText), text(a.nameLineTwoText)]).filter(Boolean);
const generic = (name: string) => /^(?:attn|attention|c o|customer number|p ?o box|suite|ste|floor|room|mail ?stop)\b/.test(counselNameKey(name))
  || /^\d+\s+/.test(name)
  || /^(?:intellectual property|patents?|ip|legal|docketing|prosecution)$/.test(counselNameKey(name))
  || /^(?:(?:patent|ip|intellectual property|legal|prosecution|docketing)\s+)*(?:department|division|group|team|services|office)$/.test(counselNameKey(name))
  || !/\p{L}/u.test(name);

function applicantMatcher(names: string[]) {
  const keys = [...new Set(names.map(identityKey).filter(Boolean))];
  const genericBrands = new Set(["international", "united", "national", "american", "global", "advanced", "general", "technology", "technologies", "research", "the", "group", "patent", "intellectual"]);
  const brands = new Set(keys.map(k => k.split(" ")[0]).filter(k => !genericBrands.has(k) && (k.length >= 4 || /\d/.test(k))));
  for (const k of keys) {
    const words = k.split(" ").filter(w => !["and", "of", "the"].includes(w));
    if (words.length >= 3) {
      const acronym = words.map(w => w[0]).join("");
      if (acronym.length >= 3 && acronym.length <= 6) brands.add(acronym);
    }
  }
  return (name: string) => {
    const k = identityKey(name);
    return keys.some(a => k === a || k.startsWith(`${a} `)) || brands.has(k.split(" ")[0]);
  };
}

/** Rank actual correspondence associations, never every firm in a customer/practitioner directory. */
export function analyzePortfolioCounsel(records: Row[], selectedNames: string[]): PublicPortfolioAdvancedAnalysisOutsideCounsel {
  const organizations = new Map<string, { name: string; applications: Set<string>; verifiedFirm: boolean }>();
  const practitioners = new Map<string, { name: string; applications: Set<string> }>();
  const applications = new Set<string>();
  for (const record of records) {
    const app = text(record.applicationNumberText);
    if (!app) continue;
    applications.add(app);
    const meta = object(record.applicationMetaData);
    const isApplicant = applicantMatcher([...selectedNames, text(meta.firstApplicantName),
      ...rows(meta.applicantBag).flatMap(a => [text(a.applicantNameText), text(a.organizationName)])].filter(Boolean));
    const attorney = object(record.recordAttorney);
    const customer = object(attorney.customerNumberCorrespondenceData);
    const legacyAttorneys = [...rows(record.attorneyBag), ...rows(meta.attorneyBag)];
    const directory = [...rows(attorney.attorneyBag), ...legacyAttorneys];
    const directoryOrganizations = addressNames(directory.flatMap(a => rows(a.attorneyAddressBag)));
    let correspondence = [...rows(record.correspondenceAddressBag), ...rows(meta.correspondenceAddressBag)];
    if (!correspondence.length && meta.customerNumber != null && String(customer.patronIdentifier) === String(meta.customerNumber)) {
      correspondence = rows(customer.powerOfAttorneyAddressBag);
    }
    // Legacy application-specific attorney addresses remain supported; the nested
    // recordAttorney directory alone is NOT evidence of representation on this case.
    if (!correspondence.length) correspondence = legacyAttorneys.flatMap(a => rows(a.attorneyAddressBag));
    for (const address of correspondence) {
      if (isApplicant(text(address.nameLineOneText))) continue;
      const choices: { name: string; key: string; verifiedFirm: boolean }[] = [];
      for (const raw of addressNames([address])) {
        let name = raw.replace(/^c\s*\/\s*o\s+/i, "").trim();
        const parenthetical = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
        if (parenthetical && isApplicant(parenthetical[2])) name = parenthetical[1].trim();
        const suffix = name.match(/^(.*)[-–—/|]\s*([^-/|–—]+)$/);
        if (suffix && isApplicant(suffix[2])) name = suffix[1].trim();
        // A legal-form suffix followed by a slash/client-routing tag still
        // identifies the same firm; do not invent what an abbreviation means.
        const legalEnd = name.match(/^(.+?\b(?:R[\s.]*L[\s.]*L[\s.]*P|L[\s.]*L[\s.]*P|P[\s.]*L[\s.]*L[\s.]*C|P[\s.]*C|P[\s.]*A|P[\s.]*S|L[\s.]*L[\s.]*C)\.?)\s*[-/|–—]/i);
        if (legalEnd) name = legalEnd[1].trim();
        if (!name || generic(name) || isApplicant(name)) continue;
        const key = identityKey(name);
        if (!key) continue;
        const matchingDirectory = directoryOrganizations.filter(n => {
          const other = identityKey(n);
          return other === key || (key.split(" ").filter(w => w !== "and").length >= 2 && other.startsWith(`${key} `));
        });
        const verifiedFirm = hasFirmDesignation(name) || matchingDirectory.some(hasFirmDesignation);
        choices.push({ name, key, verifiedFirm });
      }
      const choice = choices.find(c => c.verifiedFirm) ?? choices[0];
      if (!choice) continue;
      const { name, key, verifiedFirm } = choice;
      const entry = organizations.get(key) ?? { name, applications: new Set<string>(), verifiedFirm: false };
      entry.applications.add(app);
      entry.verifiedFirm ||= verifiedFirm;
      organizations.set(key, entry);
    }
    // Do not rank the nested customer-wide practitioner list as case attorneys.
    for (const a of legacyAttorneys) {
      const name = [text(a.firstName), text(a.middleName), text(a.lastName), text(a.nameSuffix)].filter(Boolean).join(" ");
      if (!name) continue;
      const key = counselNameKey(name);
      const entry = practitioners.get(key) ?? { name, applications: new Set<string>() };
      entry.applications.add(app);
      practitioners.set(key, entry);
    }
  }
  const counts = organizations.size ? organizations : practitioners;
  const ranked = [...counts.entries()].sort(([, a], [, b]) => b.applications.size - a.applications.size || a.name.localeCompare(b.name)).slice(0, 5);
  const entries = ranked.map(([, a]) => ({
    name: a.name, applicationCount: a.applications.size,
    portfolioSharePercent: applications.size ? Math.round(a.applications.size / applications.size * 1000) / 10 : 0,
  }));
  const unverified = organizations.size ? ranked.filter(([key]) => !organizations.get(key)?.verifiedFirm).map(([, a]) => a.name) : [];
  const identified = new Set([...counts.values()].flatMap(a => [...a.applications])).size;
  return {
    available: entries.length > 0, sampleSize: applications.size, entries,
    label: !entries.length ? "Outside Counsel Unavailable" : !organizations.size ? "Top Attorneys of Record"
      : unverified.length ? "Top Counsel / Correspondence Contacts" : "Top Outside Patent Counsel",
    note: !entries.length
      ? `No external counsel contact could be identified from the returned correspondence records for ${applications.size.toLocaleString()} sampled applications. Applicant/in-house addresses and unrelated firms in customer-wide attorney directories are not counted. This does not establish that no outside counsel was used.`
      : `${organizations.size ? "Based on structured USPTO application correspondence and matching correspondence-customer records, with matching attorney-address organization names used to corroborate firm identity." : "Based on application-specific structured attorney records, not the customer-wide practitioner directory."} Counts are distinct applications among ${applications.size.toLocaleString()} sampled records (n=${identified.toLocaleString()} with identified contacts). Applicant/in-house contacts are excluded where identifiable; record association does not prove who performed all prosecution work or a current engagement.${unverified.length ? ` Law-firm status is not confirmed for these recorded contacts: ${unverified.join("; ")}.` : ""}`,
  };
}

export const COUNSEL_SEARCH_FIELDS = [
  "attorneyBag", "correspondenceAddressBag",
  "recordAttorney.customerNumberCorrespondenceData.patronIdentifier",
  "recordAttorney.customerNumberCorrespondenceData.powerOfAttorneyAddressBag.nameLineOneText",
  "recordAttorney.customerNumberCorrespondenceData.powerOfAttorneyAddressBag.nameLineTwoText",
  "recordAttorney.attorneyBag.attorneyAddressBag.nameLineOneText",
  "recordAttorney.attorneyBag.attorneyAddressBag.nameLineTwoText",
].join(",");
