export function googlePatentsSearchUrl(patentNumber: string): string {
  const normalized = patentNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const url = new URL('https://patents.google.com/');
  url.searchParams.set('q', normalized);
  return url.toString();
}
