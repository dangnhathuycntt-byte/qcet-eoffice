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

/**
 * Đường dẫn phục vụ tệp đính kèm. Bản ghi cũ/seed lưu đường dẫn trần
 * (`/documents/2026/a.pdf`, `uploads/a.pdf`) sẽ rơi vào route trang của Next;
 * chuyển qua `/api/files/...` (route có kiểm tra quyền). URL tuyệt đối, blob
 * và đường dẫn `/api/...` giữ nguyên.
 */
export function toServedFileUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const url = fileUrl.trim();
  if (!url) return null;
  if (/^(https?:|blob:)/i.test(url) || url.startsWith('/api/') || url.startsWith('//')) return url;
  const relative = url.replace(/^\/+/, '').replace(/^uploads\//, '');
  return `/api/files/${relative}`;
}
