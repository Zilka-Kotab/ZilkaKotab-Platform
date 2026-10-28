/** Equivalent POST representation for long, read-only ODP search URLs. */
export function usptoSearchBody(url: URL): Record<string, unknown> {
  const allowed = new Set(["q", "limit", "offset", "fields", "facets", "sort"]);
  for (const key of url.searchParams.keys()) if (!allowed.has(key)) throw new Error(`Unsupported search parameter: ${key}`);
  const list = (key: string) => (url.searchParams.get(key) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const body: Record<string, unknown> = {
    q: url.searchParams.get("q") ?? "",
    pagination: { limit: Number(url.searchParams.get("limit") ?? 25), offset: Number(url.searchParams.get("offset") ?? 0) },
  };
  if (list("fields").length) body.fields = list("fields");
  if (list("facets").length) body.facets = list("facets");
  if (list("sort").length) body.sort = list("sort").map(s => {
    const [field, order = "asc"] = s.split(/\s+/);
    if (!["asc", "desc"].includes(order)) throw new Error("Invalid search sort direction.");
    return { field, order };
  });
  return body;
}
