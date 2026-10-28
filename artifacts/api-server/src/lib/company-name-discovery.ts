import type { PublicCompanyNameDiscovery } from "@workspace/api-zod";

type Row = Record<string, any>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
export const organizationNameKey = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|lp)\b/g, " ")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
export function uniqueCompanyNames(names: string[]) {
  return [...new Map(names.map(n => n.trim().replace(/\s+/g, " ")).filter(n => n.length >= 2 && n.length <= 200)
    .map(n => [n.toLocaleLowerCase(), n])).values()];
}
export const applicantScopeQuery = (names: string[]) => `applicationMetaData.firstApplicantName:(${names.map(n => `"${n.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(" OR ")})`;
const acronym = (s: string) => organizationNameKey(s).split(" ").filter(w => !["the", "of", "and", "research", "center", "technology", "licensing"].includes(w)).map(w => w[0]).join("");
export function explicitOrganizationNames(name: string) {
  return uniqueCompanyNames(name.split(/\b(?:d[\s./]*b[\s./]*a|f[\s./]*k[\s./]*a|a[\s./]*k[\s./]*a|doing business as|formerly known as|also known as)\b\.?/i));
}
export function applicantNameMatches(candidate: string, seeds: string[]) {
  return explicitOrganizationNames(candidate).some(part => {
    const key = organizationNameKey(part);
    return key && seeds.some(seed => {
      const input = organizationNameKey(seed);
      return input && (key === input || key.startsWith(`${input} `)
        || (input.replace(/ /g, "").length <= 6 && !input.includes(" ") && acronym(part) === input));
    });
  });
}
const businessTypes = new Set(["Q4830453", "Q6881511", "Q891723", "Q783794", "Q161726", "Q167037", "Q155076", "Q18388277"]);
const values = (entity: Row, property: string) => (Array.isArray(entity.claims?.[property]) ? entity.claims[property] : [])
  .filter((c: Row) => c.rank !== "deprecated").map((c: Row) => row(row(c.mainsnak).datavalue).value);
export function wikidataCompanyNames(entity: Row) {
  return uniqueCompanyNames([
    entity.labels?.en?.value, entity.labels?.mul?.value,
    ...values(entity, "P1448").map((v: Row) => row(v).text),
    ...values(entity, "P1813").map((v: Row) => row(v).text),
  ].filter((v): v is string => typeof v === "string" && !/https?:|www\.|\.com\b/i.test(v)));
}
export function chooseWikidataCompany(entities: Row[], query: string): Row | null {
  const key = organizationNameKey(query);
  const candidates = entities.filter(e => values(e, "P31").some((v: Row) => businessTypes.has(row(v).id)))
    .filter(e => {
      const aliases = [...Object.values(row(e.aliases)).flatMap(v => Array.isArray(v) ? v.map(a => row(a).value) : []), ...wikidataCompanyNames(e)];
      return aliases.some(name => typeof name === "string" && organizationNameKey(name) === key);
    });
  return candidates.length === 1 ? candidates[0] : null;
}
export function chooseGleifEntity(records: Row[], seeds: string[]) {
  const keys = new Set(seeds.map(organizationNameKey));
  const matched = records.filter(r => {
    const e = row(row(r.attributes).entity);
    const names = [row(e.legalName).name, ...(Array.isArray(e.otherNames) ? e.otherNames.map((n: Row) => n.name) : [])];
    return names.some(n => typeof n === "string" && keys.has(organizationNameKey(n)));
  });
  return matched.length === 1 ? matched[0] : null;
}
async function getJson(url: URL, deadline: number) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "PatentPortfolioAnalyzer/1.0" }, signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return row(await response.json());
}
const cache = new Map<string, { expires: number; result: Promise<PublicCompanyNameDiscovery> }>();
export async function discoverCompanyNames(query: string, additional: string[] = []): Promise<PublicCompanyNameDiscovery> {
  const key = query.trim().toLowerCase();
  let entry = cache.get(key);
  if (!entry || entry.expires <= Date.now()) {
    entry = { expires: Date.now() + 7 * 86400000, result: discover(query) };
    cache.set(key, entry);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    void entry.result.then(result => {
      if (!result.sources.length || result.warnings.some(w => /unavailable|No unique|No unambiguous|exceeded/i.test(w))) entry!.expires = Date.now() + 300000;
    }).catch(() => { cache.delete(key); });
  }
  const base = structuredClone(await entry.result);
  return { ...base, searchedNames: uniqueCompanyNames([query, ...base.searchedNames, ...additional]) };
}
async function discover(query: string): Promise<PublicCompanyNameDiscovery> {
  const out: PublicCompanyNameDiscovery = {
    searchedNames: [query], sources: [],
    warnings: ["No public source provides an exhaustive DBA register. Names are discovery suggestions; confirm applicant affiliation. This tool searches applicant records, not an exhaustive assignment-based ownership history."],
  };
  const deadline = Date.now() + 12000;
  try {
    const search = new URL("https://www.wikidata.org/w/api.php");
    for (const [k, v] of Object.entries({ action: "wbsearchentities", search: query, language: "en", type: "item", format: "json", limit: "5" })) search.searchParams.set(k, v);
    const found = await getJson(search, deadline);
    const ids = (Array.isArray(found.search) ? found.search : []).map((r: Row) => r.id).filter((id: unknown) => typeof id === "string" && /^Q\d+$/.test(id));
    if (ids.length) {
      const detail = new URL("https://www.wikidata.org/w/api.php");
      for (const [k, v] of Object.entries({ action: "wbgetentities", ids: ids.join("|"), props: "labels|aliases|claims", languages: "en|mul", format: "json" })) detail.searchParams.set(k, v);
      const body = await getJson(detail, deadline);
      const company = chooseWikidataCompany(Object.values(row(body.entities)).map(row), query);
      if (company) {
        const names = wikidataCompanyNames(company);
        out.searchedNames.push(...names);
        out.sources.push({ label: "Wikidata company official/former-name statements — confirm affiliation", url: `https://www.wikidata.org/wiki/${company.id}`, retrievedAt: new Date().toISOString(), names });
      } else out.warnings.push("No unambiguous corporate identity was resolved in Wikidata; records for different entities were not combined.");
    }
  } catch { out.warnings.push("Public company-name statements were unavailable. Enter any known former or trading names manually."); }
  try {
    const current = out.sources[0]?.names[0] ?? query;
    const url = new URL("https://api.gleif.org/api/v1/lei-records");
    url.searchParams.set("filter[fulltext]", current); url.searchParams.set("page[size]", "200");
    const body = await getJson(url, Date.now() + 6000);
    const records = Array.isArray(body.data) ? body.data.map(row) : [];
    const total = Number(row(row(body.meta).pagination).total);
    // A truncated registry response cannot establish uniqueness.
    const registry = total <= records.length ? chooseGleifEntity(records, out.searchedNames) : null;
    if (registry && /^[A-Z0-9]{20}$/.test(registry.id)) {
      const entity = row(row(registry.attributes).entity);
      const names = uniqueCompanyNames([row(entity.legalName).name, ...(Array.isArray(entity.otherNames) ? entity.otherNames.map((n: Row) => n.name) : [])].filter((n): n is string => typeof n === "string"));
      out.searchedNames.push(...names);
      out.sources.push({ label: "GLEIF registered legal, other and previous names", url: `https://search.gleif.org/#/record/${registry.id}`, retrievedAt: new Date().toISOString(), names });
    } else out.warnings.push(total > records.length ? "GLEIF results exceeded the lookup window; registry aliases were not inferred from incomplete results." : "No unique matching LEI registry entity was found; GLEIF does not cover every company or DBA.");
  } catch { out.warnings.push("The LEI name registry was unavailable; registry-name coverage could not be verified."); }
  out.searchedNames = uniqueCompanyNames(out.searchedNames);
  return out;
}
