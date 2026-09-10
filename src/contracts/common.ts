import { z } from 'zod';

/**
 * Common pagination query schema.
 * Coerces string parameters from URL query strings into bounded integers.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  pageSize: z.coerce
    .number()
    .int('Page size must be an integer')
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20),
  cursor: z.string().trim().max(100, 'Cursor cannot exceed 100 characters').optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Allowed operational scopes across QCET E-Office.
 */
export const OperationalScopeSchema = z.enum(['school', 'unit', 'personal']);
export type OperationalScope = z.infer<typeof OperationalScopeSchema>;

/**
 * Common search query schema bounding query length to 100 characters and limit to 50.
 */
export const SearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
  query: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50, 'Limit cannot exceed 50')
    .optional()
    .default(20),
  scope: OperationalScopeSchema.optional(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Strict Search API query schema alias for SearchQuerySchema.
 */
export const SearchApiQuerySchema = SearchQuerySchema;

export type SearchApiQuery = z.infer<typeof SearchApiQuerySchema>;

/**
 * Standard identifier schema (UUID, CUID, or alphanumeric entity ID).
 */
export const IdSchema = z
  .string()
  .trim()
  .min(1, 'ID cannot be empty')
  .max(128, 'ID cannot exceed 128 characters');

export type EntityId = z.infer<typeof IdSchema>;

/**
 * ISO date string validation schema.
 * Validates ISO 8601 strings (YYYY-MM-DD or full ISO 8601 with time/timezone).
 */
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)?)?$/;

export const IsoDateStringSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return false;
      if (!ISO_DATE_REGEX.test(val)) return false;
      const parsed = Date.parse(val);
      return !Number.isNaN(parsed);
    },
    { message: 'Invalid ISO date string format' }
  );

export type IsoDateString = z.infer<typeof IsoDateStringSchema>;
