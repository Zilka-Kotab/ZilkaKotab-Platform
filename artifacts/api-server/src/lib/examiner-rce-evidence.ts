export const RCE_CALCULATION_VERSION = "independent-rce-continuation-v3";
export type JsonRecord = Record<string, unknown>;
export type Evidence = {
  state: "yes" | "no" | "unavailable" | "error";
  retrievedAt: string; expiresAt: string; version: string;
  source: string; note: string;
  events?: { date: string | null; description: string }[];
  children?: { applicationNumber: string; filingDate: string | null }[];
};
export type UsptoFetch = (url: URL, signal?: AbortSignal) => Promise<Response>;
const obj = (v: unknown): JsonRecord => v && typeof v === "object" ? v as JsonRecord : {};
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
export const applicationId = (v: unknown) => str(v).replace(/\D/g, "");
const root = "https://api.uspto.gov/api/v1/patent/applications";

export function evidence(state: Evidence["state"], source: string, note: string, extra: Partial<Evidence> = {}): Evidence {
  const now = new Date();
  return { state, source, note, retrievedAt: now.toISOString(), expiresAt: new Date(+now + (state === "yes" || state === "no" ? 7 * 86400000 : 300000)).toISOString(), version: RCE_CALCULATION_VERSION, ...extra };
}

export function parseRceTransactions(id: string, raw: unknown, source = `${root}/${id}/transactions`): Evidence {
  if (!Array.isArray(raw) || !raw.length) return evidence("unavailable", source, "Transaction history missing or empty; not a confirmed negative.");
  const events = raw.map(obj);
  if (events.some(e => !str(e.eventCode))) return evidence("unavailable", source, "Incomplete transaction entries.");
  const rces = events.filter(e => str(e.eventCode) === "RCEX");
  if (rces.some(e => /amendment|after.final response|continuation application/i.test(str(e.eventDescriptionText)) && !/continued examination/i.test(str(e.eventDescriptionText)))) {
    return evidence("unavailable", source, "Conflicting RCE code/description requires document verification.");
  }
  if (rces.length) return evidence("yes", source, "RCEX: Request for Continued Examination; counted once per application.", {
    events: rces.map(e => ({ date: str(e.eventDate) || null, description: str(e.eventDescriptionText) || "RCEX" })),
  });
  if (events.some(e => /request.*continued examination|\bRCE\b/i.test(str(e.eventDescriptionText)))) {
    return evidence("unavailable", source, "RCE-related text without an unambiguous RCEX filing requires document verification.");
  }
  return evidence("no", source, `No RCE filing in ${events.length} returned prosecution transactions.`);
}

export function parseContinuationChildren(id: string, raw: unknown, knownDates: Record<string, string> = {}, source = `${root}/${id}/continuity`): Evidence {
  if (!Array.isArray(raw)) return evidence("unavailable", source, "Child continuity omitted; reverse relationship verification required.");
  const children = new Map<string, { applicationNumber: string; filingDate: string | null }>();
  let incomplete = false, matched = false;
  for (const value of raw) {
    const r = obj(value), parent = applicationId(r.parentApplicationNumberText), child = applicationId(r.childApplicationNumberText);
    const foreign = (v: unknown) => !/^US/i.test(str(v)) && /^(?:PCT|[A-Z]{2}\s*[\d/])/i.test(str(v));
    if (foreign(r.parentApplicationNumberText) || foreign(r.childApplicationNumberText)) { matched ||= parent === id; continue; }
    if (!parent || !child || parent === child) { incomplete = true; continue; }
    if (parent !== id) continue;
    matched = true;
    if (!/^\d{8}$/.test(child) || /^(60|61|62|63)/.test(child)) continue;
    const kind = str(r.claimParentageTypeCode).toUpperCase();
    if (["DIV", "CIP", "PRO", "PCT", "NST", "FPR"].includes(kind)) continue;
    if (kind !== "CON") { incomplete = true; continue; }
    const description = str(r.claimParentageTypeCodeDescriptionText);
    if (/divisional|continuation.in.part|provisional|foreign/i.test(description)) { incomplete = true; continue; }
    const date = str(r.childApplicationFilingDate) || str(r.childApplicationfilingDate) || knownDates[child] || null;
    if (date && knownDates[id] && date < knownDates[id]) { incomplete = true; continue; }
    children.set(child, { applicationNumber: child, filingDate: date });
  }
  if (children.size) return evidence("yes", source, "Express CON child relationships; RCE, DIV, CIP, provisional and foreign relations excluded.", { children: [...children.values()] });
  if (incomplete || (raw.length && !matched)) return evidence("unavailable", source, "No direct CON child established; reverse verification needed.");
  return evidence("no", source, "Dedicated continuity response contains no qualifying CON children (empty list or explicitly excluded relationship types).", { children: [] });
}

async function jsonRequest(url: URL, get: UsptoFetch) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await get(url, AbortSignal.timeout(25000));
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = Number(response.headers.get("retry-after"));
        await new Promise(r => setTimeout(r, Math.max(500 * 2 ** attempt, Number.isFinite(retry) ? retry * 1000 : 0)));
        continue;
      }
      const body: unknown = await response.json();
      return { status: response.status, body: obj(body) };
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

function applicationRecord(body: JsonRecord, id: string) {
  const bags = body.patentFileWrapperDataBag;
  if (body.count !== 1 || !Array.isArray(bags) || bags.length !== 1) throw new Error("Incomplete application response.");
  const record = obj(bags[0]);
  if (applicationId(record.applicationNumberText) !== id) throw new Error("Application response identity mismatch.");
  return record;
}

export async function fetchRceEvidence(id: string, get: UsptoFetch): Promise<Evidence> {
  const source = `${root}/${id}/transactions`;
  try {
    const result = await jsonRequest(new URL(source), get);
    if (result.status !== 200) return evidence("error", source, `Transaction endpoint returned HTTP ${result.status}; not a negative.`);
    const parsed = parseRceTransactions(id, applicationRecord(result.body, id).eventDataBag);
    if (parsed.state !== "unavailable") return parsed;
    const docs = await jsonRequest(new URL(`${root}/${id}/documents`), get);
    if (docs.status === 200 && Array.isArray(docs.body.documentBag)) {
      const filing = docs.body.documentBag.map(obj).filter(d => applicationId(d.applicationNumberText) === id
        && ["RCEX", "RCE", "RCE.NE"].includes(str(d.documentCode))
        && /request.*continued examination/i.test(str(d.documentCodeDescriptionText)));
      if (filing.length) return evidence("yes", `${root}/${id}/documents`, "RCE request filing corroborated by official document metadata. A filed request marked Not Entered is a filing, not proof of acceptance.", {
        events: filing.map(d => ({ date: str(d.officialDate).slice(0, 10) || null, description: str(d.documentCodeDescriptionText) })),
      });
      const events = applicationRecord(result.body, id).eventDataBag;
      const relevant = Array.isArray(events) ? events.map(obj).filter(e => /RCE|request.*continued examination/i.test(`${str(e.eventCode)} ${str(e.eventDescriptionText)}`)) : [];
      const onlyWorkflow = relevant.length > 0 && relevant.every(e => ["BRCE", "FRCE"].includes(str(e.eventCode))
        && /^Workflow - Request for RCE - (?:Begin|Finish)$/i.test(str(e.eventDescriptionText)));
      const completeDocuments = Number.isInteger(docs.body.count) && docs.body.count === docs.body.documentBag.length
        && docs.body.documentBag.every(d => applicationId(obj(d).applicationNumberText) === id && Boolean(str(obj(d).documentCode)));
      const otherRceDocuments = docs.body.documentBag.some(d => /RCE|continued examination/i.test(`${str(obj(d).documentCode)} ${str(obj(d).documentCodeDescriptionText)}`));
      if (onlyWorkflow && completeDocuments && !otherRceDocuments) return evidence("no", `${root}/${id}/documents`,
        "Only BRCE/FRCE administrative workflow markers were present. Complete returned transaction and document records contain no located RCE request filing; workflow markers alone are not filings.");
    }
    return parsed;
  } catch { return evidence("error", source, "Transaction/document request failed after retries; not a negative."); }
}

/**
 * Cohort application identities have already been verified by the main search.
 * Query the authoritative reverse parent index in batches, rather than assuming
 * a missing Search childContinuityBag means no children. Negatives require the
 * entire stable result set; positive CON relationships survive partial pages.
 */
export async function fetchContinuationBatch(ids: string[], get: UsptoFetch, knownDates: Record<string, string> = {}): Promise<Map<string, Evidence>> {
  if (!ids.length || ids.length > 50 || ids.some(id => !/^\d{8}$/.test(id)) || new Set(ids).size !== ids.length) throw new Error("Invalid continuity batch.");
  const wanted = new Set(ids);
  const dates = { ...knownDates };
  const found = new Map(ids.map(id => [id, [] as unknown[]]));
  const url = new URL(`${root}/search`);
  url.searchParams.set("q", `parentContinuityBag.parentApplicationNumberText:(${ids.join(" OR ")})`);
  url.searchParams.set("fields", "applicationNumberText,applicationMetaData.filingDate,parentContinuityBag");
  url.searchParams.set("limit", "100");
  url.searchParams.set("sort", "applicationNumberText asc");
  const source = url.toString();
  let complete = false, problem = "Incomplete reverse continuity index.", count: number | null = null;
  const seen = new Set<string>();
  try {
    for (let offset = 0; offset < 1000; offset += 100) {
      url.searchParams.set("offset", String(offset));
      const response = await jsonRequest(url, get);
      if (response.status === 404 && offset === 0 && /No matching records found/i.test(str(response.body.detailedMessage))) { complete = true; break; }
      const bag = response.body.patentFileWrapperDataBag;
      if (response.status !== 200 || !Array.isArray(bag) || !Number.isInteger(response.body.count) || Number(response.body.count) < 0) {
        problem = `Reverse continuity index unavailable (HTTP ${response.status}); not a negative.`; break;
      }
      if (count !== null && count !== response.body.count) { problem = "Reverse continuity index changed during retrieval."; break; }
      count = Number(response.body.count);
      if (bag.length !== Math.min(100, Math.max(0, count - offset))) { problem = "Incomplete reverse continuity page."; break; }
      let malformed = false;
      for (const raw of bag) {
        const r = obj(raw), recordId = str(r.applicationNumberText).toUpperCase(), child = applicationId(recordId);
        // Reverse searches legitimately return PCT/foreign descendants too.
        // Preserve their identifiers; the relationship parser excludes them.
        const validId = /^(?:\d{8}|PCT[A-Z0-9/ -]+|[A-Z]{2}[\d/ -]+)$/.test(recordId);
        const key = recordId.replace(/[ /-]/g, "");
        if (!validId || seen.has(key) || !Array.isArray(r.parentContinuityBag)) { malformed = true; break; }
        seen.add(key);
        const date = str(obj(r.applicationMetaData).filingDate);
        if (/^\d{8}$/.test(recordId) && /^\d{4}-\d{2}-\d{2}$/.test(date)) dates[child] = date;
        let matched = false;
        for (const parent of r.parentContinuityBag.map(obj)) {
          const id = applicationId(parent.parentApplicationNumberText);
          if (!wanted.has(id)) continue;
          matched = true;
          // A returned descendant can carry the whole chain. Its direct CON
          // child for this parent can be an intermediate application.
          found.get(id)!.push(parent);
        }
        if (!matched || malformed) { malformed = true; break; }
      }
      if (malformed) { problem = "Malformed or duplicate reverse continuity records; not a complete negative."; break; }
      if (offset + bag.length >= count) { complete = true; break; }
      problem = "Reverse continuity results exceeded the batch page budget.";
    }
  } catch { problem = "Reverse continuity index request failed after retries; not a negative."; }
  return new Map(ids.map(id => {
    const parsed = parseContinuationChildren(id, found.get(id)!, dates, source);
    if (parsed.state === "yes") return [id, parsed];
    if (complete && parsed.state === "no") return [id, evidence("no", source,
      "Complete, stable USPTO reverse parent index contains no qualifying publicly recorded CON child for this verified cohort application. DIV, CIP, provisional and foreign relationships excluded.", { children: [] })];
    return [id, evidence("unavailable", source, complete ? parsed.note : problem)];
  }));
}

export async function fetchContinuationEvidence(id: string, get: UsptoFetch, knownDates: Record<string, string> = {}): Promise<Evidence> {
  const source = `${root}/${id}/continuity`;
  try {
    const result = await jsonRequest(new URL(source), get);
    if (result.status !== 200) return evidence("error", source, `Continuity endpoint returned HTTP ${result.status}; not a negative.`);
    const record = applicationRecord(result.body, id);
    const parsed = parseContinuationChildren(id, record.childContinuityBag, knownDates);
    if (parsed.state === "yes" || parsed.state === "no") return parsed;
    // Dedicated responses can omit child bags even when parent information is
    // available. Verify the reverse index rather than guessing no children.
    const found: unknown[] = [];
    let count: number | null = null;
    for (let offset = 0; offset < 1000; offset += 100) {
      const url = new URL(`${root}/search`);
      url.searchParams.set("q", `parentContinuityBag.parentApplicationNumberText:${id}`);
      url.searchParams.set("fields", "applicationNumberText,parentContinuityBag");
      url.searchParams.set("limit", "100"); url.searchParams.set("offset", String(offset));
      const reverse = await jsonRequest(url, get);
      if (reverse.status === 404 && /No matching records found/i.test(str(reverse.body.detailedMessage)) && offset === 0) {
        return evidence("no", source, "Dedicated continuity record verified; reverse USPTO parent index confirms no publicly recorded continuation children.", { children: [] });
      }
      if (reverse.status !== 200 || !Array.isArray(reverse.body.patentFileWrapperDataBag) || typeof reverse.body.count !== "number") return evidence("unavailable", source, "Reverse continuity index unavailable; not a negative.");
      if (count !== null && count !== reverse.body.count) return evidence("unavailable", source, "Reverse index changed during retrieval.");
      count = reverse.body.count;
      const rows = reverse.body.patentFileWrapperDataBag;
      if (rows.length !== Math.min(100, count - offset)) return evidence("unavailable", source, "Incomplete reverse continuity page.");
      for (const row of rows) {
        const parents = obj(row).parentContinuityBag;
        if (!Array.isArray(parents)) return evidence("unavailable", source, "Reverse relationship evidence missing.");
        found.push(...parents.map(obj).filter(r => applicationId(r.parentApplicationNumberText) === id));
      }
      const positive = parseContinuationChildren(id, found, knownDates, `${source} (reverse parent index corroboration)`);
      if (positive.state === "yes") return positive;
      if (offset + rows.length >= count) {
        if (count === 0 || found.length) {
          const malformed = found.some(raw => {
            const r = obj(raw); return !["DIV", "CIP", "PRO", "PCT", "NST", "FPR"].includes(str(r.claimParentageTypeCode));
          });
          if (!malformed) return evidence("no", source, "Complete reverse index contains no qualifying CON children (other relationship types excluded).", { children: [] });
        }
        return evidence("unavailable", source, "Reverse relationships did not establish a complete negative.");
      }
    }
    return evidence("unavailable", source, "Reverse continuity results exceed the bounded lookup budget.");
  } catch { return evidence("error", source, "Continuity request failed after retries; not a negative."); }
}
