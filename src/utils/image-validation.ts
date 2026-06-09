/**
 * Returns true for image paths that are safe to render in an <img> tag inside
 * the TinaCMS admin. Rejects data: URIs, javascript: URIs, and requests to
 * arbitrary external hosts — all legitimate paths start with /.
 */
export function isSafeSrc(s: string): boolean {
  return s === "" || s.startsWith("/") || s.startsWith("https://thirstypig.com/");
}
