type Staff = { id: number; name: string; email: string };
const personKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Resolve only exact emails or unambiguous full names; never substring/initial matches. */
export function assignedStaffIds(value: unknown, staff: Staff[]): number[] {
  if (typeof value !== "string") return [];
  const candidates = value.split(/[;|\n]+/).flatMap((part) => {
    const emails = part.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) ?? [];
    const comma = part.split(",").map((s) => s.trim());
    return [part, ...emails, ...comma, ...(comma.length === 2 ? [`${comma[1]} ${comma[0]}`] : [])];
  }).map(personKey).filter(Boolean);
  const ids = new Set<number>();
  for (const candidate of candidates) {
    const byEmail = staff.filter((s) => personKey(s.email) === candidate);
    const matches = byEmail.length ? byEmail : staff.filter((s) => personKey(s.name) === candidate);
    if (matches.length === 1) ids.add(matches[0]!.id);
  }
  return [...ids];
}

export function appCollParticipants(owner: string, rawRecord: Record<string, unknown>, staff: Staff[]): number[] {
  const ids = new Set(assignedStaffIds(owner, staff));
  for (const [key, value] of Object.entries(rawRecord)) {
    const name = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (name === "owner" || /contribut/.test(name)) assignedStaffIds(value, staff).forEach((id) => ids.add(id));
  }
  return [...ids];
}
