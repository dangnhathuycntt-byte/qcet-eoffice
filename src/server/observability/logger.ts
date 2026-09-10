/**
 * Canonical Structured Logger & Observability Engine for QCET E-Office.
 *
 * Implements Phase 10: Observability & Structured Logging
 * - Single-line JSON structured logging to stdout/stderr.
 * - Standard attributes: timestamp, level, event, requestId, durationMs, errorCode, metadata.
 * - Mandatory Security & Secret Redaction: Automatically sanitizes sensitive keys and values
 *   (passwords, tokens, secrets, JWTs, cookies, authorization headers, session secrets, credentials).
 * - Request ID extraction and propagation.
 * - Next.js HTTP request logging helper.
 */

import { sanitizeLogContext, sanitizeUrl } from '@/telemetry/sanitize';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string | null;
  durationMs?: number;
  route?: string;
  action?: string;
  resourceId?: string;
  userId?: string | null;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface LogData {
  requestId?: string | null;
  durationMs?: number;
  route?: string;
  action?: string;
  resourceId?: string;
  userId?: string | null;
  errorCode?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export type LogWriter = (entry: StructuredLogEntry, rawJson: string) => void;

/**
 * Sensitive key stems to aggressively redact in structured logging.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /bearer/i,
  /authorization/i,
  /auth_token/i,
  /jwt/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /database[_-]?url/i,
  /db[_-]?url/i,
  /mat[_-]?khau/i,
  /van[_-]?ban[_-]?mat/i,
  /noi[_-]?dung[_-]?mat/i,
  /raw[_-]?payload/i,
];

/**
 * Checks whether a key matches any sensitive pattern.
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  // Guard against safe keys containing substring (e.g. author, authority)
  const lower = key.toLowerCase();
  if (lower === 'author' || lower === 'authority' || lower === 'authorid') {
    return false;
  }
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Redacts sensitive fields, keys, JWTs, bearer tokens, and credentials from any data structure.
 * Safe against circular references and never mutates original input.
 */
export function redactSensitiveData<T = unknown>(data: T): unknown {
  return sanitizeLogContext(data, {
    customSensitiveKeys: [
      'credential',
      'credentials',
      'sessionToken',
      'sessionSecret',
      'database_url',
      'db_url',
      'mat_khau',
      'van_ban_mat',
      'noi_dung_mat',
      'raw_payload',
    ],
  });
}

/**
 * Resolves a Request ID from incoming request headers, an object, or generates a UUID.
 */
export function getRequestId(req?: any): string {
  if (!req) {
    return crypto.randomUUID();
  }

  if (typeof req === 'string' && req.trim()) {
    return req.trim();
  }

  if (typeof req.requestId === 'string' && req.requestId.trim()) {
    return req.requestId.trim();
  }

  const headers = req.headers;
  if (headers) {
    if (typeof headers.get === 'function') {
      const headerVal =
        headers.get('x-request-id') ||
        headers.get('x-correlation-id') ||
        headers.get('x-trace-id');
      if (headerVal && headerVal.trim()) {
        return headerVal.trim();
      }
    } else if (typeof headers === 'object') {
      const headerVal =
        headers['x-request-id'] ||
        headers['x-correlation-id'] ||
        headers['x-trace-id'];
      if (typeof headerVal === 'string' && headerVal.trim()) {
        return headerVal.trim();
      }
    }
  }

  if (typeof req.get === 'function') {
    const headerVal =
      req.get('x-request-id') ||
      req.get('x-correlation-id') ||
      req.get('x-trace-id');
    if (headerVal && headerVal.trim()) {
      return headerVal.trim();
    }
  }

  return crypto.randomUUID();
}

export class StructuredLogger {
  private customWriter?: LogWriter;

  /**
   * Overrides log output writer for testing or external aggregation.
   */
  public setWriter(writer?: LogWriter): void {
    this.customWriter = writer;
  }

  /**
   * Emits a single-line JSON structured log entry.
   */
  private emit(
    level: LogLevel,
    event: string,
    data?: LogData | unknown,
    error?: unknown
  ): StructuredLogEntry {
    const timestamp = new Date().toISOString();

    let resolvedData: LogData = {};
    let resolvedError: unknown = error;

    if (data instanceof Error) {
      resolvedError = data;
    } else if (data && typeof data === 'object') {
      resolvedData = { ...(data as LogData) };
    }

    const requestId = resolvedData.requestId !== undefined ? resolvedData.requestId : undefined;
    const durationMs = typeof resolvedData.durationMs === 'number' ? resolvedData.durationMs : undefined;
    const route = typeof resolvedData.route === 'string' ? resolvedData.route : undefined;
    const action = typeof resolvedData.action === 'string' ? resolvedData.action : undefined;
    const resourceId = typeof resolvedData.resourceId === 'string' ? resolvedData.resourceId : undefined;
    const userId = resolvedData.userId !== undefined ? resolvedData.userId : undefined;

    let errorCode = resolvedData.errorCode;
    if (!errorCode && resolvedError && typeof resolvedError === 'object') {
      errorCode =
        (resolvedError as any).code ||
        (resolvedError as any).name ||
        'ERROR';
    }

    // Separate explicit standard fields from ad-hoc metadata fields
    const {
      requestId: _r,
      durationMs: _d,
      route: _route,
      action: _act,
      resourceId: _resId,
      userId: _uId,
      errorCode: _e,
      metadata: explicitMetadata,
      ...extraFields
    } = resolvedData;

    let metadata: Record<string, any> | undefined;

    const mergedMetadata: Record<string, any> = {
      ...(explicitMetadata || {}),
      ...extraFields,
    };

    if (resolvedError) {
      if (resolvedError instanceof Error) {
        mergedMetadata.error = {
          name: resolvedError.name,
          message: resolvedError.message,
          ...(resolvedError.stack ? { stack: resolvedError.stack } : {}),
          ...('code' in resolvedError ? { code: (resolvedError as any).code } : {}),
        };
      } else {
        mergedMetadata.error = String(resolvedError);
      }
    }

    if (Object.keys(mergedMetadata).length > 0) {
      metadata = redactSensitiveData(mergedMetadata) as Record<string, any>;
    }

    const entry: StructuredLogEntry = {
      timestamp,
      level,
      event,
      ...(requestId !== undefined ? { requestId } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(route !== undefined ? { route } : {}),
      ...(action !== undefined ? { action } : {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    };

    const singleLineJson = JSON.stringify(entry);

    if (this.customWriter) {
      try {
        this.customWriter(entry, singleLineJson);
      } catch {
        // Custom writer failure must never throw
      }
      return entry;
    }

    if (level === 'error') {
      if (typeof process !== 'undefined' && process.stderr?.write) {
        process.stderr.write(singleLineJson + '\n');
      } else {
        console.error(singleLineJson);
      }
    } else if (level === 'warn') {
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(singleLineJson + '\n');
      } else {
        console.warn(singleLineJson);
      }
    } else {
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(singleLineJson + '\n');
      } else {
        console.log(singleLineJson);
      }
    }

    return entry;
  }

  public info(event: string, data?: LogData): StructuredLogEntry {
    return this.emit('info', event, data);
  }

  public warn(event: string, data?: LogData): StructuredLogEntry {
    return this.emit('warn', event, data);
  }

  public error(event: string, data?: LogData | unknown, error?: unknown): StructuredLogEntry {
    return this.emit('error', event, data, error);
  }

  public debug(event: string, data?: LogData): StructuredLogEntry {
    return this.emit('debug', event, data);
  }

  /**
   * Structured Domain Action logger helper.
   * Records operational domain actions with standard attributes (route, action, resourceId, durationMs, requestId).
   */
  public action(
    actionName: string,
    data?: {
      route?: string;
      resourceId?: string;
      userId?: string | null;
      durationMs?: number;
      requestId?: string | null;
      metadata?: Record<string, any>;
      [key: string]: any;
    }
  ): StructuredLogEntry {
    return this.emit('info', `action.${actionName}`, {
      action: actionName,
      route: data?.route,
      resourceId: data?.resourceId,
      userId: data?.userId,
      durationMs: data?.durationMs,
      requestId: data?.requestId,
      metadata: data?.metadata,
      ...data,
    });
  }

  /**
   * Structured Security Event: Denied Authorization
   */
  public authorizationDenied(data: {
    requestId?: string | null;
    userId?: string | null;
    action?: string;
    resourceId?: string;
    reason?: string;
    route?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): StructuredLogEntry {
    return this.emit('warn', 'security.authorization_denied', {
      errorCode: 'FORBIDDEN',
      ...data,
      metadata: {
        ...(data.metadata || {}),
        reason: data.reason,
      },
    });
  }

  /**
   * Structured Security & Workflow Event: Invalid State Transition
   */
  public invalidTransition(data: {
    requestId?: string | null;
    userId?: string | null;
    entity?: string;
    entityId?: string;
    fromState?: string;
    toState?: string;
    reason?: string;
    route?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): StructuredLogEntry {
    return this.emit('warn', 'workflow.invalid_transition', {
      errorCode: 'INVALID_TRANSITION',
      resourceId: data.entityId,
      ...data,
      metadata: {
        ...(data.metadata || {}),
        entity: data.entity,
        fromState: data.fromState,
        toState: data.toState,
        reason: data.reason,
      },
    });
  }

  /**
   * Structured Database Event: Optimistic Concurrency Conflict
   */
  public concurrencyConflict(data: {
    requestId?: string | null;
    userId?: string | null;
    entity?: string;
    entityId?: string;
    expectedVersion?: number;
    actualVersion?: number | null;
    route?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): StructuredLogEntry {
    return this.emit('warn', 'database.concurrency_conflict', {
      errorCode: 'CONCURRENCY_CONFLICT',
      resourceId: data.entityId,
      ...data,
      metadata: {
        ...(data.metadata || {}),
        entity: data.entity,
        expectedVersion: data.expectedVersion,
        actualVersion: data.actualVersion,
      },
    });
  }

  /**
   * Structured Security Event: File Streaming / Access Denied
   */
  public fileAccessDenied(data: {
    requestId?: string | null;
    userId?: string | null;
    filePath?: string;
    fileName?: string;
    reason?: string;
    resourceType?: string;
    resourceId?: string;
    route?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): StructuredLogEntry {
    return this.emit('warn', 'security.file_access_denied', {
      errorCode: 'FORBIDDEN',
      ...data,
      metadata: {
        ...(data.metadata || {}),
        filePath: data.filePath,
        fileName: data.fileName,
        resourceType: data.resourceType,
        reason: data.reason,
      },
    });
  }

  /**
   * Structured HTTP request/response logger helper.
   */
  public httpRequest(
    req: any,
    res: any,
    durationMs: number
  ): StructuredLogEntry {
    const status =
      typeof res === 'number'
        ? res
        : typeof res?.status === 'number'
        ? res.status
        : typeof res?.statusCode === 'number'
        ? res.statusCode
        : 200;

    const method = req?.method || 'GET';
    const rawUrl = req?.url || '/';
    const sanitizedUrl = sanitizeUrl(rawUrl);
    const requestId = getRequestId(req);

    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const errorCode = status >= 400 ? `HTTP_${status}` : undefined;

    let userAgent: string | undefined;
    let clientIp: string | undefined;

    if (req) {
      if (typeof req.headers?.get === 'function') {
        userAgent = req.headers.get('user-agent') || undefined;
        clientIp =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          undefined;
      } else if (req.headers && typeof req.headers === 'object') {
        userAgent = req.headers['user-agent'];
        clientIp =
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.headers['x-real-ip'];
      }
      if (!clientIp && typeof req.ip === 'string') {
        clientIp = req.ip;
      }
    }

    return this.emit(level, 'http.request', {
      requestId,
      durationMs,
      errorCode,
      metadata: {
        method,
        url: sanitizedUrl,
        status,
        ...(clientIp ? { ip: clientIp } : {}),
        ...(userAgent ? { userAgent } : {}),
      },
    });
  }
}

/**
 * Singleton canonical structured logger instance.
 */
export const logger = new StructuredLogger();
