export interface NextMaintenanceFee {
  availability: "UPCOMING" | "NONE" | "UNKNOWN";
  window: string | null;
  dueDate: string | null;
  graceEndDate: string | null;
  amount?: number;
}

const maintenanceMilestones = [
  { window: "3.5-year fee", dueMonths: 42, graceMonths: 48 },
  { window: "7.5-year fee", dueMonths: 90, graceMonths: 96 },
  { window: "11.5-year fee", dueMonths: 138, graceMonths: 144 },
] as const;

function addMonthsToDate(value: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const source = new Date(Date.UTC(year, month, day));
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month || source.getUTCDate() !== day) return null;
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const finalDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, finalDay))).toISOString().slice(0, 10);
}

function newYorkCalendarDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function emptyFee(availability: "NONE" | "UNKNOWN"): NextMaintenanceFee {
  return { availability, window: null, dueDate: null, graceEndDate: null };
}

export function getNextMaintenanceFee(
  issueDate: string | null | undefined,
  patentStatus: string | null | undefined,
  now = new Date(),
): NextMaintenanceFee {
  if (/\b(expired|lapsed|abandoned)\b/i.test(patentStatus ?? "")) return emptyFee("NONE");
  if (!issueDate) return emptyFee("UNKNOWN");

  const today = newYorkCalendarDate(now);
  for (const milestone of maintenanceMilestones) {
    const dueDate = addMonthsToDate(issueDate, milestone.dueMonths);
    const graceEndDate = addMonthsToDate(issueDate, milestone.graceMonths);
    if (!dueDate || !graceEndDate) return emptyFee("UNKNOWN");
    if (graceEndDate >= today) {
      return {
        availability: "UPCOMING",
        window: milestone.window,
        dueDate,
        graceEndDate,
      };
    }
  }
  return emptyFee("NONE");
}
