export function calendarDate(value: string): string | null {
  const input = value.trim().split(/[T ]/)[0] ?? "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!iso && !us) return null;
  const y = Number(iso ? iso[1] : us![3]), m = Number(iso ? iso[2] : us![1]), d = Number(iso ? iso[3] : us![2]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 2200 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
}
export function parseFirmCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && !field) quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some((v) => v.trim())) rows.push(row);
      row = []; field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field); if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
const normalize = (v: string) => v.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = {
  externalId: ["taskid", "externaltaskid", "dockettaskid", "id"],
  matter: ["matter", "attorneyref", "matterreference", "matterid", "appcollmatterid"],
  title: ["tasktype", "tasktitle", "taskname", "title"],
  client: ["client", "clientname"],
  owner: ["owner", "assignedpractitioner", "assignedto", "attorney"],
  due: ["respondby", "officialduedate", "duedate", "deadline"],
  closed: ["closedon", "completeddate", "completiondate", "closeddate"],
  status: ["taskstatus", "status"],
  description: ["comments", "taskdescription", "description", "discussion"],
} as const;
export type FirmCsvTask = { externalId: string; matter: string; title: string; client: string; owner: string; due: string | null; closed: string | null; status: string; description: string; raw: Record<string, string> };
export function readFirmCsv(text: string): { rows: FirmCsvTask[]; errors: string[] } {
  const parsed = parseFirmCsv(text), errors: string[] = [];
  const headers = parsed.shift();
  if (!headers || !parsed.length) return { rows: [], errors: ["The CSV must have a header and at least one task."] };
  if (new Set(headers.map(normalize)).size !== headers.length) return { rows: [], errors: ["The CSV contains duplicate column names. Use a single header for each field."] };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([k, names]) => [k, headers.findIndex((h) => (names as readonly string[]).includes(normalize(h)))])) as Record<keyof typeof aliases, number>;
  for (const key of ["externalId", "matter", "title"] as const) if (indexes[key] < 0) errors.push(`Missing ${key} column. Use TaskID, Matter, and TaskType headers.`);
  if (errors.length) return { rows: [], errors };
  const seen = new Set<string>();
  const rows = parsed.map((cells, i) => {
    const get = (key: keyof typeof aliases) => (cells[indexes[key]] ?? "").trim();
    const externalId = get("externalId"), matter = get("matter"), title = get("title");
    if (cells.length !== headers.length) errors.push(`Row ${i + 2}: ${cells.length} cells for ${headers.length} columns.`);
    if (!externalId || !matter || !title) errors.push(`Row ${i + 2}: TaskID, Matter and TaskType are required.`);
    if (externalId.length > 240 || matter.length > 500 || get("owner").length > 240 || get("status").length > 80) errors.push(`Row ${i + 2}: an identifier, owner, or status is too long.`);
    if (seen.has(externalId)) errors.push(`Row ${i + 2}: duplicate TaskID ${externalId}.`);
    seen.add(externalId);
    const raw = Object.fromEntries(headers.map((h, j) => [h.replace(/^\uFEFF/, ""), cells[j] ?? ""]));
    const finalDue = cells[headers.findIndex((h) => normalize(h) === "finalduedate")]?.trim() ?? "";
    const due = get("due") || finalDue;
    if (due && !calendarDate(due)) errors.push(`Row ${i + 2}: invalid due date; use YYYY-MM-DD or MM/DD/YYYY.`);
    if (get("closed") && !calendarDate(get("closed"))) errors.push(`Row ${i + 2}: invalid closed date; use YYYY-MM-DD or MM/DD/YYYY.`);
    return { externalId, matter, title, client: get("client"), owner: get("owner"), due: calendarDate(due), closed: calendarDate(get("closed")), status: get("status"), description: get("description"), raw };
  });
  return { rows, errors };
}
