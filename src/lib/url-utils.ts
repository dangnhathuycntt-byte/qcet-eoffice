/**
 * Validates that a URL uses a safe protocol (http, https, blob).
 * Prevents javascript: protocol injection (XSS).
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function safeHref(url: string | null | undefined): string {
  return isSafeUrl(url) ? url! : '#';
}
