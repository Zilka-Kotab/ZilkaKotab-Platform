export type ExaminerGrantCandidate = {
  applicationNumber: string;
  grantDate: string;
  examinerName?: string;
};
type GetMetadata = (url: URL, signal: AbortSignal) => Promise<Response>;
type SearchRecord = { applicationNumberText?: unknown; applicationMetaData?: { grantDate?: unknown; examinerNameText?: unknown } };
export const normalizedExaminerName = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

/** Discovery only. Assignment metadata alone is never dated examination evidence. */
export async function discoverHistoricalGrants(name: string, getMetadata: GetMetadata, signal: AbortSignal) {
  const parts = name.split(",");
  const surname = normalizedExaminerName(parts[0] ?? "");
  const given = normalizedExaminerName(parts[1] ?? "").split(" ").filter(Boolean);
  const quoted = (s: string) => `"${s.replace(/[\\"]/g, "\\$&")}"`;
  const field = "applicationMetaData.examinerNameText";
  const range = `applicationMetaData.grantDate:[1900-01-01 TO ${new Date().toISOString().slice(0, 10)}]`;
  const family = parts.length === 2 && given[0]?.length > 1
    ? `${field}:${quoted(surname)} AND ${field}:${quoted(given[0])}`
    : `${field}:${quoted(name)}`;
  const request = async (q: string, limit: number, sorted: boolean, offset = 0): Promise<{ count: number; patentFileWrapperDataBag: SearchRecord[] }> => {
    const url = new URL("https://api.uspto.gov/api/v1/patent/applications/search");
    url.searchParams.set("q", `${q} AND ${range}`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("fields", "applicationNumberText,applicationMetaData");
    if (sorted) url.searchParams.set("sort", "applicationMetaData.grantDate asc");
    const response = await getMetadata(url, signal);
    if (response.status === 404) return { count: 0, patentFileWrapperDataBag: [] };
    if (!response.ok) throw new Error("Historical examiner discovery unavailable.");
    const raw = await response.json();
    if (!raw || typeof raw !== "object") throw new Error("Incomplete historical examiner search.");
    const body = raw as Record<string, unknown>;
    if (typeof body.count !== "number" || !Number.isSafeInteger(body.count) || body.count < 0 || !Array.isArray(body.patentFileWrapperDataBag)) throw new Error("Incomplete historical examiner search.");
    return { count: body.count, patentFileWrapperDataBag: body.patentFileWrapperDataBag.filter(item => item && typeof item === "object") as SearchRecord[] };
  };
  // Check actual names across the family, not NOT "canonical name": a phrase
  // exclusion could also hide another person's name with additional initials.
  const oldest = await request(`${field}:${quoted(name)}`, 12, true);
  let omittedMiddleAllowed = parts.length === 2 && given.length > 1 && given[0].length > 1;
  if (omittedMiddleAllowed) {
    let count: number | undefined;
    const seen = new Set<string>();
    for (let offset = 0; ; offset += 100) {
      const page = await request(family, 100, false, offset);
      count ??= page.count;
      if (count > 5000 || page.count !== count || page.patentFileWrapperDataBag.length !== Math.min(100, count - offset)) {
        omittedMiddleAllowed = false; break;
      }
      if (page.patentFileWrapperDataBag.some(record => {
        const n = record.applicationMetaData?.examinerNameText;
        const id = record.applicationNumberText;
        if (typeof id !== "string" || seen.has(id)) return true;
        seen.add(id);
        return typeof n !== "string" || normalizedExaminerName(n) !== normalizedExaminerName(name);
      })) { omittedMiddleAllowed = false; break; }
      if (offset + page.patentFileWrapperDataBag.length >= count) break;
    }
  }
  const candidates: ExaminerGrantCandidate[] = oldest.patentFileWrapperDataBag.flatMap((record) => {
    const meta = record?.applicationMetaData;
    return typeof record?.applicationNumberText === "string" && /^\d+$/.test(record.applicationNumberText)
      && typeof meta?.grantDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.grantDate)
      && typeof meta?.examinerNameText === "string" && normalizedExaminerName(meta.examinerNameText) === normalizedExaminerName(name)
      ? [{ applicationNumber: record.applicationNumberText, grantDate: meta.grantDate, examinerName: meta.examinerNameText }] : [];
  });
  if (oldest.count > 0 && candidates.length === 0) throw new Error("Historical search did not resolve the selected examiner.");
  if (candidates.some((candidate, i) => i > 0 && candidate.grantDate < candidates[i - 1].grantDate)) throw new Error("Historical search was not ordered by grant date.");
  return { candidates, omittedMiddleAllowed };
}
