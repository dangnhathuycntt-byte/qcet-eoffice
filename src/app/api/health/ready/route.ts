import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { prisma } from '@/lib/prisma';
import { isServerShuttingDown } from '@/server/lifecycle/shutdown';
import { getPrivateStorageDir } from '@/storage/private-files';
import { getRateLimitBackend, getRateLimitBackendInfo } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Readiness Probe: Checks if the application is ready to accept production traffic.
 * Validates:
 * 1. Database connectivity (PostgreSQL query execution & latency).
 * 2. Schema migrations status (Prisma migrations table check).
 * 3. File storage accessibility (read/write access to private storage).
 * 4. Critical configuration validation (safe presence check, zero secrets exposed).
 */
export async function GET() {
  const startTime = Date.now();

  if (isServerShuttingDown()) {
    return NextResponse.json(
      {
        status: 'degraded',
        terminating: true,
        reason: 'Server is terminating',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  // 1. Database Connectivity Check
  let dbHealthy = false;
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbHealthy = true;
  } catch (err: any) {
    dbHealthy = false;
    dbError = 'Database unreachable';
  }

  // 2. Schema Migrations Check
  let schemaHealthy = false;
  let migrationsCount = 0;
  let schemaError: string | undefined;

  if (dbHealthy) {
    try {
      const migrationRows = (await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM _prisma_migrations
        WHERE rolled_back_at IS NULL
      `) as Array<{ count: number }>;

      migrationsCount = migrationRows[0]?.count ?? 0;
      schemaHealthy = migrationsCount > 0;
      if (!schemaHealthy) {
        schemaError = 'No migrations applied';
      }
    } catch {
      // If _prisma_migrations doesn't exist or error, fallback to table check
      try {
        const tableRows = (await prisma.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `) as Array<{ count: number }>;
        const count = tableRows[0]?.count ?? 0;
        schemaHealthy = count > 0;
        migrationsCount = count;
      } catch (err: any) {
        schemaHealthy = false;
        schemaError = 'Schema check failed';
      }
    }
  }

  // 3. Storage Accessibility Check
  let storageHealthy = false;
  let storageDir: string;
  let storageError: string | undefined;

  try {
    storageDir = getPrivateStorageDir();
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.accessSync(storageDir, fs.constants.R_OK | fs.constants.W_OK);
    storageHealthy = true;
  } catch (err: any) {
    storageHealthy = false;
    storageError = 'Storage directory inaccessible or unwritable';
  }

  // 4. Critical Configuration Presence Check (Zero secrets exposed)
  const hasDbUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
  const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
  const isProd = process.env.NODE_ENV === 'production';
  const hasValidJwtSecret = jwtSecret.trim().length >= (isProd ? 32 : 8);

  const configHealthy = hasDbUrl && hasValidJwtSecret;
  const configChecks = {
    databaseConfigured: hasDbUrl,
    authSecretConfigured: hasValidJwtSecret,
    environment: process.env.NODE_ENV || 'development',
  };

  // 5. Rate-limit backend check (Issue #29, corrective review). The shared
  // backend is mandatory in production: missing Redis config OR an
  // unreachable Redis both yield 503, because the limiter fails closed
  // without it. In development/test the process-local test double is
  // reported explicitly as non-production mode (healthy) so local and CI
  // deployments without Redis stay green.
  const rateLimitInfo = getRateLimitBackendInfo();
  const isProductionRuntime = process.env.NODE_ENV === 'production';
  let rateLimitHealthy = true;
  let rateLimitLatencyMs = 0;
  let rateLimitError: string | undefined;
  let rateLimitMode = rateLimitInfo.mode;
  if (isProductionRuntime && !rateLimitInfo.redisConfigured) {
    rateLimitHealthy = false;
    rateLimitError = 'Shared rate-limit backend (REDIS_URL) is required in production';
  } else if (rateLimitInfo.redisConfigured) {
    try {
      const rlStart = Date.now();
      const pingWithTimeout = Promise.race([
        getRateLimitBackend().ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout after 3000ms')), 3000)
        ),
      ]);
      await pingWithTimeout;
      rateLimitLatencyMs = Date.now() - rlStart;
    } catch {
      rateLimitHealthy = false;
      rateLimitError = 'Shared rate-limit backend unreachable';
    }
  } else {
    rateLimitMode = 'memory-test-double';
  }

  const isOverallReady = dbHealthy && schemaHealthy && storageHealthy && configHealthy && rateLimitHealthy;
  const totalDurationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isOverallReady ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          latencyMs: dbLatencyMs,
          ...(dbError ? { error: dbError } : {}),
        },
        schema: {
          status: schemaHealthy ? 'healthy' : 'unhealthy',
          appliedMigrations: migrationsCount,
          ...(schemaError ? { error: schemaError } : {}),
        },
        storage: {
          status: storageHealthy ? 'healthy' : 'unhealthy',
          ...(storageError ? { error: storageError } : {}),
        },
        config: {
          status: configHealthy ? 'healthy' : 'unhealthy',
          ...configChecks,
        },
        ratelimit: {
          status: rateLimitHealthy ? 'healthy' : 'unhealthy',
          mode: rateLimitMode,
          redisConfigured: rateLimitInfo.redisConfigured,
          latencyMs: rateLimitLatencyMs,
          ...(rateLimitError ? { error: rateLimitError } : {}),
        },
      },
      durationMs: totalDurationMs,
    },
    {
      status: isOverallReady ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
