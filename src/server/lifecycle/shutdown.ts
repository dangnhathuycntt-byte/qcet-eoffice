/**
 * Graceful Shutdown Manager for QCET E-Office
 * Handles SIGTERM and SIGINT signals cleanly in production containers.
 * Closes database connection pool and ensures in-flight operations finish safely.
 */
import { prisma } from "@/lib/prisma";
import { logger } from "@/server/observability/logger";

let shutdownRegistered = false;
let isShuttingDown = false;

export type ShutdownHook = () => Promise<void> | void;

interface RegisteredHook {
  name: string;
  priority: number; // lower number runs earlier
  fn: ShutdownHook;
}

const registeredHooks: RegisteredHook[] = [];

export interface ShutdownOptions {
  timeoutMs?: number;
  exitOnComplete?: boolean;
}

/**
 * Registers an asynchronous hook to run during graceful shutdown before DB disconnection.
 * Lower priority numbers execute earlier.
 */
export function registerShutdownHook(
  hook: ShutdownHook,
  options?: { name?: string; priority?: number }
): void {
  registeredHooks.push({
    name: options?.name || `hook-${registeredHooks.length + 1}`,
    priority: options?.priority ?? 100,
    fn: hook,
  });
  registeredHooks.sort((a, b) => a.priority - b.priority);
}

/**
 * Marks server as terminating without immediately executing hooks (used for probe testing / early drain).
 */
export function markServerTerminating(): void {
  isShuttingDown = true;
}

export async function executeGracefulShutdown(
  signal: string,
  options: ShutdownOptions = {}
): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  const timeoutMs = options.timeoutMs ?? 5000;
  const exitOnComplete = options.exitOnComplete ?? false;

  logger.info("app.shutdown.start", {
    metadata: {
      signal,
      pid: typeof process !== "undefined" ? process.pid : undefined,
      timeoutMs,
      hooksCount: registeredHooks.length,
    },
  });

  const forceTimer = setTimeout(() => {
    logger.warn("app.shutdown.timeout", {
      metadata: {
        signal,
        message: "Shutdown timed out before connections closed cleanly; forcing exit.",
      },
    });
    if (exitOnComplete && typeof process !== "undefined" && process.exit) {
      process.exit(1);
    }
  }, timeoutMs);

  if (typeof forceTimer.unref === "function") {
    forceTimer.unref();
  }

  try {
    // 1. Execute registered hooks in ascending priority order
    for (const hook of registeredHooks) {
      try {
        await Promise.resolve(hook.fn());
      } catch (hookErr) {
        logger.error("app.shutdown.hook_error", { metadata: { hook: hook.name } }, hookErr);
      }
    }

    // 2. Gracefully disconnect Prisma Client to release DB connections
    await prisma.$disconnect();
    logger.info("app.shutdown.complete", {
      metadata: {
        signal,
        databaseDisconnected: true,
      },
    });
  } catch (err) {
    logger.error("app.shutdown.error", undefined, err);
  } finally {
    clearTimeout(forceTimer);
    if (exitOnComplete && typeof process !== "undefined" && process.exit) {
      process.exit(0);
    }
  }
}

export function registerGracefulShutdown(options: ShutdownOptions = {}): void {
  if (shutdownRegistered || typeof process === "undefined" || !process.on) {
    return;
  }
  shutdownRegistered = true;

  const handleSignal = (signal: string) => {
    executeGracefulShutdown(signal, { ...options, exitOnComplete: options.exitOnComplete ?? true }).catch((err) => {
      logger.error("app.shutdown.unhandled", undefined, err);
      if (options.exitOnComplete !== false && typeof process !== "undefined" && process.exit) {
        process.exit(1);
      }
    });
  };

  process.once("SIGTERM", () => handleSignal("SIGTERM"));
  process.once("SIGINT", () => handleSignal("SIGINT"));
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Helper to reset state in testing environments
 */
export function resetShutdownStateForTesting(): void {
  shutdownRegistered = false;
  isShuttingDown = false;
  registeredHooks.length = 0;
}

export const _resetShutdownStateForTesting = resetShutdownStateForTesting;
