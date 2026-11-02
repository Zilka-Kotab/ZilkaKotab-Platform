const words = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function nameInContact(text: string, selectedName: string): boolean {
  const parts = selectedName.includes(",") ? selectedName.split(",") : null;
  const names = words(selectedName).split(" ");
  const last = words(parts ? parts[0] : names.at(-1)!);
  const given = words(parts ? parts.slice(1).join(" ") : names.slice(0, -1).join(" ")).split(" ");
  if (!last || !given[0] || given[0].length < 2) return false;
  const middle = given.slice(1).map((m) => m.length === 1 ? `${escaped(m)}[A-Z]*` : `(?:${escaped(m)}|${escaped(m[0])})`).join(" ");
  const firstLast = `${escaped(given[0])}${middle ? ` ${middle}` : ""} ${escaped(last)}`;
  const lastFirst = `${escaped(last)} ${escaped(given[0])}${middle ? ` ${middle}` : ""}`;
  return new RegExp(`\\b(?:${firstLast}|${lastFirst})\\b`).test(words(text));
}

export type ExtractedContact = { email: string | null; phone: string | null; evidenceText: string };
/** Additional corroboration for weaker OCR/signature-window evidence; this
 * only validates an address already printed in a document, never creates one. */
export function emailCorroboratesName(email: string, name: string): boolean {
  const p = name.includes(",") ? name.split(",") : null;
  const n = words(name).split(" ");
  const last = words(p ? p[0] : n.at(-1)!).replace(/ /g, "").toLowerCase();
  const first = words(p ? p.slice(1).join(" ") : n[0]).split(" ")[0].toLowerCase();
  const local = email.split("@")[0].replace(/[^a-z]/gi, "").toLowerCase();
  return !!last && !!first && local.includes(last) && (local.includes(first) || local.startsWith(first[0]));
}
export function extractExaminerContact(text: string, name: string): ExtractedContact[] {
  const clean = text.replace(/\u00ad/g, "").replace(/([a-z0-9._%+-])\s*@\s*uspto\s*\.\s*gov\b/gi, "$1@uspto.gov");
  const blocks: { text: string; compact: boolean }[] = [];
  // Explicit examiner-contact paragraphs terminate BEFORE the supervisor's
  // details. A document may contain multiple USPTO staff contact addresses.
  const starts = [...clean.matchAll(/(?:Any\s+inquir(?:y|ies)|(?:contact|direct(?:ed)?)\s+(?:the\s+)?examiner|Examiner(?:'s)?\s+(?:contact|e-?mail|telephone))/gi)];
  for (const start of starts) {
    const at = start.index!;
    const segment = clean.slice(at, at + 1500);
    const stop = segment.search(/if\s+attempts|supervis(?:or|ory)|help\s*desk|customer\s*service|fax\s+number/i);
    blocks.push({ text: stop >= 0 ? segment.slice(0, stop) : segment, compact: false });
  }
  // Some recent letters have a compact, explicitly named signature/contact
  // block instead of the standard inquiry paragraph.
  for (const match of clean.matchAll(/[a-z0-9._%+-]+@uspto\.gov\b/gi)) {
    const at = match.index!;
    const segment = clean.slice(Math.max(0, at - 220), Math.min(clean.length, at + match[0].length + 100));
    if (!/supervis(?:or|ory)|help\s*desk|customer\s*service/i.test(segment) && /\bexaminer\b/i.test(segment)) blocks.push({ text: segment, compact: true });
  }
  return blocks.flatMap(({ text: b, compact }) => {
    const clauseEnd = b.search(/whose\s+telephone|can\s+(?:normally\s+)?be\s+reached|e-?mail\s*(?:address)?\s*[:=]/i);
    if (!nameInContact(compact ? b : b.slice(0, clauseEnd >= 0 ? clauseEnd : 350), name)) return [];
    const emails = [...new Set((b.match(/[a-z0-9._%+-]+@uspto\.gov\b/gi) ?? []).map((s) => s.toLowerCase()))];
    // Multiple distinct emails in one block are ambiguous; never select first.
    let email = emails.length === 1 ? emails[0] : null;
    if (email && compact) {
      // A loose signature window is weaker than an explicitly directed
      // contact paragraph: require the *printed* local part to corroborate
      // the surname and given name/initial as well.
      if (!emailCorroboratesName(email, name)) return [];
    }
    const numbers = [...b.matchAll(/\(?([2-9]\d{2})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})/g)]
      .filter((m) => !/fax/i.test(b.slice(Math.max(0, m.index! - 30), m.index!)))
      .map((m) => `(${m[1]}) ${m[2]}-${m[3]}`);
    const phones = [...new Set(numbers)];
    const phone = phones.length === 1 ? phones[0] : null;
    return email || phone ? [{ email, phone, evidenceText: b.trim().replace(/\s+/g, " ").slice(0, 1100) }] : [];
  });
}
