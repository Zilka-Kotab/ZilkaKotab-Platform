import { createHash } from "node:crypto";
import { db, examinerContactCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requestUspto, downloadUsptoDocument } from "./public-patent-tools";
import { lookupExaminerContact, type ExaminerContact, type ContactDocument } from "./examiner-contact";
import { extractExaminerContact, emailCorroboratesName } from "./examiner-contact-extraction";
import { readOfficeAction } from "./examiner-document-text";
import { logger } from "./logger";

const ROOT = "https://api.uspto.gov/api/v1/patent/applications";
const pending = new Map<string, Promise<ExaminerContact>>();
const recent = new Map<string, { expires: number; result: ExaminerContact }>();
const VERSION = "office-action-contact-v1";
type RecordData = Record<string, unknown>;
type Candidate = { id: string; identifier: string; code: string; date: string; url: string };
const obj = (v: unknown): RecordData => v && typeof v === "object" && !Array.isArray(v) ? v as RecordData : {};
const str = (v: unknown) => typeof v === "string" ? v : "";

async function json(url: URL, signal: AbortSignal) {
  const response = await requestUspto(url, signal);
  if (!response.ok) throw new Error("ODP contact evidence unavailable");
  return obj(await response.json());
}

async function candidates(name: string, artUnit: string | null, signal: AbortSignal): Promise<Candidate[]> {
  if (!artUnit || !/^\d{4}$/.test(artUnit)) return [];
  const url = new URL(`${ROOT}/search`);
  // Exact name and art-unit intersection; names are quoted/escaped, not used
  // as raw search syntax. Assignment discovers documents, not their authors.
  const quoted = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const scope = `applicationMetaData.examinerNameText:"${quoted}" AND applicationMetaData.groupArtUnitNumber:${artUnit}`;
  url.searchParams.set("q", `${scope} AND (eventDataBag.eventCode:CTNF OR eventDataBag.eventCode:CTFR)`);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "applicationNumberText,applicationMetaData");
  url.searchParams.set("sort", "applicationMetaData.filingDate desc");
  let data = await json(url, signal);
  if (data.count === 0) { url.searchParams.set("q", scope); data = await json(url, signal); }
  const records = Array.isArray(data.patentFileWrapperDataBag) ? data.patentFileWrapperDataBag.map(obj) : [];
  const docs: Candidate[] = [];
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const record of records) {
    signal.throwIfAborted();
    const meta = obj(record.applicationMetaData);
    const id = str(record.applicationNumberText);
    if (!/^\d{8}$/.test(id) || normalize(str(meta.examinerNameText)) !== normalize(name) ||
      String(meta.groupArtUnitNumber) !== artUnit) continue;
    try {
      const body = await json(new URL(`${ROOT}/${id}/documents`), signal);
      for (const raw of Array.isArray(body.documentBag) ? body.documentBag : []) {
        const d = obj(raw);
        const code = str(d.documentCode);
        const date = str(d.officialDate).slice(0, 10);
        // NOA is an official outgoing examiner notice, used only after actual
        // Office Actions. Never inspect applicant responses or correspondence.
        if (!["CTNF", "CTFR", "CTRS", "NOA"].includes(code) || d.directionCategory !== "OUTGOING" ||
          d.applicationNumberText !== id || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Date.parse(date) < Date.now() - 3 * 366 * 86400_000 || Date.parse(date) > Date.now()) continue;
        const option = (Array.isArray(d.downloadOptionBag) ? d.downloadOptionBag : []).map(obj)
          .find((o) => /pdf/i.test(str(o.mimeTypeIdentifier)) && str(o.downloadUrl).startsWith(`${ROOT.replace("/patent", "/download")}/${id}/`));
        if (!option || !str(d.documentIdentifier)) continue;
        docs.push({ id, identifier: str(d.documentIdentifier), code, date, url: str(option.downloadUrl) });
      }
    } catch { if (signal.aborted) throw new Error("Contact evidence time budget reached"); }
  }
  return docs.sort((a, b) => Number(a.code === "NOA") - Number(b.code === "NOA") || b.date.localeCompare(a.date)).slice(0, 6);
}

async function collect(name: string, artUnit: string | null): Promise<ExaminerContact> {
  const directory = await lookupExaminerContact(name);
  const base: ExaminerContact = { ...directory, confidence: directory.email || directory.phone ? "moderate" : "none",
    verificationMethod: directory.status === "matched" ? "directory" : "unverified", sourceDocuments: [] };
  const signal = AbortSignal.timeout(85_000);
  const hits: { email: string | null; phone: string | null; source: ContactDocument }[] = [];
  let inspected = 0, failed = 0;
  try {
    for (const d of await candidates(name, artUnit, signal)) {
      signal.throwIfAborted();
      try {
        const pages = await readOfficeAction(await downloadUsptoDocument(d.url, signal), signal);
        inspected++;
        for (const page of pages) {
          for (const found of extractExaminerContact(page.text, name)) {
            const email = page.method === "ocr" && found.email && !emailCorroboratesName(found.email, name) ? null : found.email;
            if (!email && !found.phone) continue;
            hits.push({ ...found, email, source: { applicationNumber: d.id, documentIdentifier: d.identifier,
              documentCode: d.code, documentDate: d.date, sourceUrl: d.url, pageNumber: page.page,
              evidenceText: found.evidenceText, extractionMethod: page.method } });
          }
        }
        const emailSources = new Map<string, Set<string>>();
        for (const hit of hits) if (hit.email) {
          const sources = emailSources.get(hit.email) ?? new Set<string>();
          sources.add(hit.source.documentIdentifier); emailSources.set(hit.email, sources);
        }
        if (emailSources.size === 1 && [...emailSources.values()][0].size >= 2) break;
      } catch { failed++; if (signal.aborted) break; }
    }
  } catch { failed++; }
  const emails = [...new Set(hits.flatMap((h) => h.email ? [h.email] : []))];
  const sources = [...new Map(hits.map((h) => [`${h.source.applicationNumber}:${h.source.documentIdentifier}:${h.source.pageNumber}`, h.source])).values()];
  if (emails.length > 1) return { ...base, email: null, checkedAt: new Date().toISOString(),
    confidence: "none", status: "ambiguous", sourceDocuments: sources,
    note: "Conflicting examiner email addresses were located in recent ODP documents. Email is Not Available until the conflict can be resolved; no address was selected automatically." };
  const email = emails[0] ?? base.email;
  const matching = hits.filter((h) => !email || h.email === email);
  const phoneSet = [...new Set(matching.flatMap((h) => h.phone ? [h.phone] : []))];
  const phone = base.phone ?? (phoneSet.length === 1 ? phoneSet[0] : null);
  const corroborated = email && new Set(matching.filter((h) => h.email === email)
    .map((h) => `${h.source.applicationNumber}:${h.source.documentIdentifier}`)).size >= 2;
  const documentEmail = emails.length === 1;
  return { ...base, status: email || phone ? "matched" : "unavailable", email, phone,
    sourceUrl: documentEmail ? matching[0].source.sourceUrl : base.sourceUrl,
    sourceDocuments: sources, checkedAt: new Date().toISOString(),
    confidence: documentEmail ? corroborated ? "high" : "moderate" : phone ? "moderate" : "none",
    verificationMethod: documentEmail || (!base.phone && phone) ? "odp_document" : base.verificationMethod,
    note: documentEmail
      ? `Email was explicitly printed in ${corroborated ? "multiple" : "one"} recent, examiner-named ODP document${corroborated ? "s" : ""}. ${base.phone ? "Phone is the current USPTO directory listing." : "Phone, when available, is from the examiner's own contact paragraph."} Document evidence is historical, not confirmation of current deliverability.`
      : `${base.email ? "Email is from the verified USPTO directory listing; no additional email evidence was verified" : "Email is Not Available: no unambiguous examiner-attributed email was verified"} in ${inspected} recent ODP document${inspected === 1 ? "" : "s"}. This is a bounded sample, not an exhaustive history; OCR covers the first and final three pages of scanned PDFs.${failed ? " Some documents could not be processed within the lookup budget." : ""} ${base.phone ? "Phone is from the verified USPTO directory listing." : ""} No email address was inferred.`,
  };
}

/** Cache is shared across applications and server restarts, by name + art unit. */
export async function verifiedExaminerContact(name: string, artUnit: string | null): Promise<ExaminerContact> {
  const identityKey = createHash("sha256").update(JSON.stringify([VERSION, name.toUpperCase().replace(/[^A-Z0-9]/g, ""), artUnit])).digest("hex");
  const local = recent.get(identityKey);
  if (local && local.expires > Date.now()) return local.result;
  const active = pending.get(identityKey);
  if (active) return active;
  const work = (async () => {
    try {
      const [cached] = await db.select().from(examinerContactCacheTable).where(eq(examinerContactCacheTable.identityKey, identityKey));
      if (cached && cached.expiresAt.getTime() > Date.now()) {
        const result = cached.result as ExaminerContact;
        recent.set(identityKey, { expires: cached.expiresAt.getTime(), result }); return result;
      }
    } catch { logger.warn({ code: "CONTACT_CACHE_READ_FAILED" }, "Persistent examiner contact cache unavailable"); }
    const result = await collect(name, artUnit);
    const expires = Date.now() + (result.email && result.confidence !== "none" ? 14 * 86400_000 : 60 * 60_000);
    try {
      const value = { identityKey, examinerName: name, artUnit, result, verifiedAt: new Date(result.checkedAt), expiresAt: new Date(expires) };
      await db.insert(examinerContactCacheTable).values(value).onConflictDoUpdate({ target: examinerContactCacheTable.identityKey, set: value });
    } catch { logger.warn({ code: "CONTACT_CACHE_WRITE_FAILED" }, "Examiner evidence could not be cached persistently"); }
    if (recent.size >= 200) recent.delete(recent.keys().next().value!);
    recent.set(identityKey, { expires, result });
    return result;
  })();
  pending.set(identityKey, work);
  try { return await work; } finally { pending.delete(identityKey); }
}
