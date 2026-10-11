/** Hàm dùng chung cho các mapper DTO: chuẩn hoá ngày giờ và phiên bản từ bản ghi thô. */

export function toISOStringSafe(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date(0).toISOString() : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function extractDateString(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

export function extractVersion(raw: Record<string, any>): number {
  if (typeof raw.version === 'number' && !isNaN(raw.version)) {
    return raw.version;
  }
  if (typeof raw.version === 'string') {
    const parsed = parseInt(raw.version, 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (raw.updatedAt) {
    const ts = new Date(raw.updatedAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  return 1;
}
