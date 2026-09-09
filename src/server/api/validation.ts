import { type ZodType, ZodError } from 'zod';
import {
  UnsupportedMediaTypeError,
  PayloadTooLargeError,
  ValidationError,
} from './errors';

export const MAX_JSON_BODY_SIZE = 1024 * 1024;       // 1MB
export const MAX_AUTH_BODY_SIZE = 64 * 1024;         // 64KB
export const MAX_QUERY_STRING_LENGTH = 2048;         // 2048 characters

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Ensures requests with state-changing methods containing bodies have Content-Type: application/json.
 * Safe methods (GET, HEAD, OPTIONS, TRACE, DELETE) do not require JSON content-type.
 */
export function assertJsonContentType(request: Request): void {
  const method = request.method.toUpperCase();
  if (!METHODS_WITH_BODY.has(method)) {
    return;
  }

  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    throw new UnsupportedMediaTypeError(
      `Content-Type must be application/json, received '${contentType || 'none'}'`
    );
  }
}

/**
 * Asserts that the request Content-Length does not exceed the allowed maximum bytes.
 */
export function assertPayloadSize(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_SIZE
): void {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      throw new PayloadTooLargeError(
        `Payload size (${parsedLength} bytes) exceeds limit of ${maxBytes} bytes`
      );
    }
  }
}

/**
 * Asserts that the query string length of a URL or Request does not exceed maximum limit.
 */
export function assertQueryStringLength(
  urlOrRequest: string | Request,
  maxLength: number = MAX_QUERY_STRING_LENGTH
): void {
  const urlString = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest.url;
  try {
    const parsed = new URL(urlString, 'http://localhost');
    if (parsed.search.length > maxLength) {
      throw new ValidationError(
        `Query string length (${parsed.search.length}) exceeds maximum allowed length of ${maxLength}`,
        undefined,
        'QUERY_TOO_LONG'
      );
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // Fallback search check if URL parsing fails
    const queryIdx = urlString.indexOf('?');
    if (queryIdx !== -1 && urlString.length - queryIdx > maxLength) {
      throw new ValidationError(
        `Query string length exceeds maximum allowed length of ${maxLength}`,
        undefined,
        'QUERY_TOO_LONG'
      );
    }
  }
}

/**
 * Extracts structured field errors from a ZodError.
 */
export function extractFieldErrors(zodError: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of zodError.issues) {
    const pathKey = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!fieldErrors[pathKey]) {
      fieldErrors[pathKey] = [];
    }
    fieldErrors[pathKey].push(issue.message);
  }
  return fieldErrors;
}

export interface ParseJsonOptions {
  maxBytes?: number;
  allowEmpty?: boolean;
}

/**
 * Safely reads, parses, and validates JSON body from an incoming HTTP Request.
 *
 * 1. Verifies Content-Type is application/json.
 * 2. Checks Content-Length header against maxBytes.
 * 3. Reads raw body text and checks byte length.
 * 4. Parses JSON safely, throwing ValidationError on malformed JSON.
 * 5. Validates against the provided Zod schema and returns strongly typed data.
 */
export async function parseAndValidateJson<T>(
  request: Request,
  schema: ZodType<T>,
  options?: ParseJsonOptions
): Promise<T> {
  const maxBytes = options?.maxBytes ?? MAX_JSON_BODY_SIZE;

  // 1. Content-Type check
  assertJsonContentType(request);

  // 2. Content-Length header check
  assertPayloadSize(request, maxBytes);

  // 3. Read body text
  let rawText: string;
  try {
    rawText = await request.text();
  } catch (err) {
    throw new ValidationError('Failed to read request body');
  }

  // Check actual payload byte length
  const byteLength = Buffer.byteLength(rawText, 'utf8');
  if (byteLength > maxBytes) {
    throw new PayloadTooLargeError(
      `Payload size (${byteLength} bytes) exceeds limit of ${maxBytes} bytes`
    );
  }

  // Handle empty bodies
  if (rawText.trim().length === 0) {
    if (options?.allowEmpty) {
      const emptyResult = schema.safeParse({});
      if (emptyResult.success) {
        return emptyResult.data;
      }
      throw new ValidationError('Validation failed', extractFieldErrors(emptyResult.error));
    }
    throw new ValidationError('Invalid JSON body');
  }

  // 4. Parse JSON
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  // 5. Validate with Zod schema
  const parseResult = schema.safeParse(rawJson);
  if (!parseResult.success) {
    throw new ValidationError('Validation failed', extractFieldErrors(parseResult.error));
  }

  return parseResult.data;
}
