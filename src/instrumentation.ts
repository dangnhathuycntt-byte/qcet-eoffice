/**
 * Next.js App Router Instrumentation Lifecycle Hook.
 *
 * Implements Phase 10: Observability & Structured Logging
 * - Safely logs application boot/runtime initialization in structured format.
 * - Handles 'nodejs' and 'edge' runtimes cleanly without throwing.
 */

/**
 * Registers instrumentation hooks at application startup.
 * Guaranteed to never throw errors during server initialization.
 */
export async function register(): Promise<void> {
  if (!process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { logger } = await import('@/server/observability/logger');
      const runtime = process.env.NEXT_RUNTIME || 'nodejs';
      const environment = process.env.NODE_ENV || 'development';

      logger.info('app.boot', {
        metadata: {
          runtime,
          environment,
          service: 'qcet-eoffice',
          nodeVersion: typeof process !== 'undefined' ? process.version : undefined,
        },
      });
    } catch (error) {
      // Fail-safe: runtime boot must proceed even if telemetry environment encounters issues
      try {
        const { logger } = await import('@/server/observability/logger');
        logger.error('app.boot.error', undefined, error);
      } catch {
        console.error('[Instrumentation Boot Error]', error);
      }
    }
  }
}

/**
 * Optional App Router error listener hook for Next.js 15.
 */
export async function onRequestError(
  err: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderSource?:
      | 'react-server-components'
      | 'server-side-rendering'
      | 'client-side-rendering'
      | undefined;
  }
): Promise<void> {
  try {
    if (!process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME === 'nodejs') {
      const { logger } = await import('@/server/observability/logger');
      logger.error(
        'app.request.error',
        {
          errorCode: err.digest || 'REQUEST_ERROR',
          metadata: {
            path: request.path,
            method: request.method,
            routerKind: context.routerKind,
            routePath: context.routePath,
            routeType: context.routeType,
            digest: err.digest,
          },
        },
        err
      );
    }
  } catch {
    // Fail-safe: never throw from error listener
  }
}
