export function googlePatentsUrl(patentNumber: string): string {
  const normalized = patentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `https://patents.google.com/patent/${normalized}/en`;
}

export function espacenetUrl(patentNumber: string): string {
  const normalized = patentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const url = new URL('https://worldwide.espacenet.com/patent/search');
  url.searchParams.set('q', `pn=${normalized}`);
  return url.toString();
}
