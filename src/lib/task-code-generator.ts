/**
 * Task Code Generator Module
 * Provides atomic, race-condition-free O(1) task code generation using database-level sequences.
 * Complies with QCET-PERF-2025-01 Section 2.3.2.
 */

export interface TaskCodeOptions {
  year?: number;
  month?: number;
  scope?: string;
  departmentCode?: string;
  format?: 'NV' | 'CV';
  useRawSql?: boolean;
}

const memorySequences = new Map<string, number>();
const initializedSequences = new Set<string>();
const inFlightInits = new Map<string, Promise<void>>();

/**
 * Resets in-memory sequence counters and initialization caches (useful for unit testing).
 */
export function resetTaskCodeMemorySequences(): void {
  memorySequences.clear();
  initializedSequences.clear();
  inFlightInits.clear();
}

/**
 * Helper to find the maximum existing task sequence number matching a given prefix.
 */
async function getMaxExistingTaskNumber(client: any, prefix: string): Promise<number> {
  if (!client?.task?.findMany) return 0;
  try {
    const existingTasks = await client.task.findMany({
      where: {
        code: { startsWith: prefix },
      },
      select: { code: true },
    });
    let maxNum = 0;
    for (const t of existingTasks) {
      if (typeof t?.code === 'string') {
        const parts = t.code.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    return maxNum;
  } catch {
    return 0;
  }
}

/**
 * Generates an atomic, collision-free task code using TaskSequence table.
 * Complexity: O(1) after initialization.
 *
 * @param client PrismaClient or TransactionClient (or mock)
 * @param options TaskCodeOptions (year, month, scope, departmentCode, format)
 * @returns Formatted task code string (e.g. NV-2026-09-001 or CV-KHTV-2026-001)
 */
export async function generateTaskCodeAtomic(
  client: any,
  options?: TaskCodeOptions
): Promise<string> {
  const year = options?.year ?? new Date().getFullYear();
  const month = options?.month ?? (new Date().getMonth() + 1);
  const scope = options?.scope ?? 'SCHOOL';
  const departmentCode = options?.departmentCode ?? 'ALL';
  const format = options?.format ?? 'NV';

  const isNV = format === 'NV';
  // For monthly NV format, partition by month so all tasks in that month share continuous sequences
  const seqScope = isNV ? 'NV' : (options?.scope ?? 'SCHOOL');
  const seqDept = isNV
    ? (options?.departmentCode?.startsWith('M') ? options.departmentCode : `M${String(month).padStart(2, '0')}`)
    : (options?.departmentCode ?? 'ALL');

  const prefix = isNV
    ? `NV-${year}-${String(month).padStart(2, '0')}-`
    : `CV-${departmentCode}-${year}-`;

  let nextVal: number;

  const seqKey = `${year}:${seqScope}:${seqDept}`;
  let initialValue = 1;
  if (!initializedSequences.has(seqKey)) {
    const maxExisting = await getMaxExistingTaskNumber(client, prefix);
    initialValue = maxExisting + 1;
  }

  if (options?.useRawSql && typeof client?.$queryRaw === 'function') {
    // Atomic raw SQL sequence upsert with RETURNING
    const res: any = await client.$queryRaw`
      INSERT INTO "task_sequences" ("year", "scope", "department_code", "last_value", "updated_at")
      VALUES (${year}, ${seqScope}, ${seqDept}, ${initialValue}, NOW())
      ON CONFLICT ("year", "scope", "department_code")
      DO UPDATE SET "last_value" = "task_sequences"."last_value" + 1, "updated_at" = NOW()
      RETURNING "last_value";
    `;
    initializedSequences.add(seqKey);
    nextVal = res[0].last_value;
  } else if (client?.taskSequence?.upsert) {
    // Atomic Prisma upsert with increment (race-free, single atomic statement)
    const record = await client.taskSequence.upsert({
      where: {
        year_scope_departmentCode: {
          year,
          scope: seqScope,
          departmentCode: seqDept,
        },
      },
      create: {
        year,
        scope: seqScope,
        departmentCode: seqDept,
        lastValue: initialValue,
      },
      update: {
        lastValue: { increment: 1 },
      },
      select: {
        lastValue: true,
      },
    });
    initializedSequences.add(seqKey);
    nextVal = record.lastValue;
  } else {
    // In-memory or fallback mode for unit testing or when client lacks taskSequence
    const memKey = `${year}_${seqScope}_${seqDept}`;
    if (!memorySequences.has(memKey)) {
      let initPromise = inFlightInits.get(memKey);
      if (!initPromise) {
        initPromise = (async () => {
          const maxExisting = await getMaxExistingTaskNumber(client, prefix);
          memorySequences.set(memKey, maxExisting);
        })();
        inFlightInits.set(memKey, initPromise);
      }
      await initPromise;
    }
    const current = memorySequences.get(memKey) || 0;
    nextVal = current + 1;
    memorySequences.set(memKey, nextVal);
  }

  if (isNV) {
    return `NV-${year}-${String(month).padStart(2, '0')}-${String(nextVal).padStart(3, '0')}`;
  } else {
    return `CV-${departmentCode}-${year}-${String(nextVal).padStart(3, '0')}`;
  }
}

/**
 * Backward-compatible alias for generateTaskCodeAtomic.
 */
export async function generateTaskCode(
  client: any,
  year?: number,
  month?: number
): Promise<string> {
  return generateTaskCodeAtomic(client, { year, month });
}

/**
 * Generates an atomic task code using PostgreSQL raw SQL upsert (RETURNING last_value).
 */
export async function generateTaskCodeRawSql(
  client: any,
  options?: TaskCodeOptions
): Promise<string> {
  return generateTaskCodeAtomic(client, { ...options, useRawSql: true });
}

