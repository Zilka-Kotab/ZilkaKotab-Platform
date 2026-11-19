const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatPatentDate(value?: string | null, locale?: string) {
  if (!value) return "Not recorded";

  const dateOnly = dateOnlyPattern.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
      return "Not recorded";
    }
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "Not recorded"
    : timestamp.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}
