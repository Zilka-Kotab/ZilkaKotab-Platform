const DIRECTORY = "https://portal.uspto.gov/EmployeeSearch/";
const SEARCH = "https://portal.uspto.gov/es-services/employees/search/name";
type Employee = {
  firstName?: string; lastName?: string; middleName?: string; coreAreaCode?: string;
  email?: string; emailAddress?: string; displayPhoneNo?: string; phoneNo?: string; extension?: string;
};
export type ExaminerContact = {
  status: "matched" | "unavailable" | "ambiguous";
  email: string | null; phone: string | null; sourceUrl: string; checkedAt: string; note: string;
  confidence?: "high" | "moderate" | "none";
  verificationMethod?: "odp_document" | "directory" | "unverified";
  sourceDocuments?: ContactDocument[];
};
export type ContactDocument = {
  applicationNumber: string; documentIdentifier: string; documentCode: string; documentDate: string;
  sourceUrl: string; pageNumber: number; evidenceText: string; extractionMethod: "text" | "ocr";
};
const cache = new Map<string, { expires: number; value: Promise<ExaminerContact> }>();
const normalize = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z ]/g, " ").trim().replace(/\s+/g, " ");

/** No fuzzy matching: do not expose another employee's contact details. */
export function matchExaminerContact(name: string, employees: Employee[]): Employee | null {
  const parts = name.includes(",") ? name.split(",") : null;
  const words = normalize(name).split(" ");
  const last = normalize(parts ? parts[0] : words[words.length - 1]);
  const given = normalize(parts ? parts.slice(1).join(" ") : words.slice(0, -1).join(" ")).split(" ");
  const matches = employees.filter((e) => {
    if (e.coreAreaCode !== "P" || normalize(e.lastName ?? "") !== last ||
      normalize(e.firstName ?? "") !== given[0]) return false;
    const requestedMiddle = given.slice(1).join(" ");
    const listedMiddle = normalize(e.middleName ?? "");
    return !requestedMiddle || requestedMiddle === listedMiddle ||
      (requestedMiddle.length === 1 && listedMiddle.startsWith(requestedMiddle)) ||
      (listedMiddle.length === 1 && requestedMiddle.startsWith(listedMiddle));
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function lookupExaminerContact(name: string): Promise<ExaminerContact> {
  const key = normalize(name);
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.value;
  const value = (async (): Promise<ExaminerContact> => {
    const base = { email: null, phone: null, sourceUrl: DIRECTORY, checkedAt: new Date().toISOString() };
    try {
      const last = name.includes(",") ? name.split(",")[0].trim() : name.trim().split(/\s+/).at(-1)!;
      const first = normalize(name.includes(",") ? name.split(",").slice(1).join(" ") : name).split(" ")[0];
      const url = new URL(SEARCH);
      // This is the directory's verified LAST, FIRST search format. Narrowing
      // by both prevents common surnames from overflowing a single page.
      url.searchParams.set("Employee name", `${last}, ${first}`);
      url.searchParams.set("Page number", "1");
      url.searchParams.set("Page size", "100");
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("USPTO directory unavailable");
      const data = await response.json() as { data?: Employee[]; totalRecords?: number; hasNextPage?: boolean };
      if (!Array.isArray(data.data)) throw new Error("Unexpected USPTO directory response");
      const match = !data.hasNextPage && (data.totalRecords ?? data.data.length) <= data.data.length
        ? matchExaminerContact(name, data.data) : null;
      if (!match) return { ...base, status: "ambiguous", note: "A unique patent-examiner identity could not be verified in the USPTO employee directory. Check the official directory; no contact details have been inferred." };
      const listedEmail = match.email ?? match.emailAddress ?? "";
      const email = /^[a-z0-9._%+-]+@uspto\.gov$/i.test(listedEmail.trim()) ? listedEmail.trim() : null;
      const rawPhone = (match.displayPhoneNo ?? match.phoneNo ?? "").trim();
      const extension = /^\d{1,6}$/.test(match.extension?.trim() ?? "") ? ` ext. ${match.extension!.trim()}` : "";
      const phone = rawPhone.replace(/\D/g, "").length === 10 ? rawPhone + extension : null;
      return { ...base, status: "matched", email, phone,
        note: email ? "Contact information as listed in the USPTO employee directory." : "Email is not published in the returned USPTO directory record; no address has been inferred." };
    } catch {
      return { ...base, status: "unavailable", note: "The USPTO employee directory could not be checked. Contact details are unavailable, not inferred." };
    }
  })();
  if (cache.size >= 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 15 * 60_000, value });
  return value;
}
