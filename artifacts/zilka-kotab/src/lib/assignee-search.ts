type AssigneeMatch = { normalizedPatentNumber: string };
type PortfolioPatent = { patentNumber: string };

function patentDigits(value: string) {
  const normalized = value.toUpperCase().replace(/,/g, "");
  return normalized.match(/(?:US\s*)?(\d{6,9})(?:\s*[A-Z]\d)?/)?.[1] ?? "";
}

export function isAssigneePatentAlreadyAdded(
  match: AssigneeMatch,
  portfolio: PortfolioPatent[],
) {
  const digits = patentDigits(match.normalizedPatentNumber);
  return portfolio.some((patent) => patentDigits(patent.patentNumber) === digits);
}

export function getEligibleAssigneePatentNumbers(
  matches: AssigneeMatch[],
  portfolio: PortfolioPatent[],
) {
  return matches
    .filter((match) => !isAssigneePatentAlreadyAdded(match, portfolio))
    .map((match) => match.normalizedPatentNumber);
}

export function getSelectedEligibleAssigneePatentNumbers(
  matches: AssigneeMatch[],
  selectedNumbers: string[],
  portfolio: PortfolioPatent[],
) {
  const eligible = new Set(getEligibleAssigneePatentNumbers(matches, portfolio));
  const selected = new Set(selectedNumbers);
  return matches
    .filter((match) => eligible.has(match.normalizedPatentNumber) && selected.has(match.normalizedPatentNumber))
    .map((match) => match.normalizedPatentNumber);
}
