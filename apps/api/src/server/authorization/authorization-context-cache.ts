/**
 * AuthorizationContext Cache Strategy (Sprint 2 - Identity & Authority)
 *
 * Strategic Invariants:
 * 1. Primary rule: "Sprint đầu tiên ưu tiên correctness: per-request context.
 *    Sau này mới cache. Không premature optimization."
 * 2. Per-request fresh evaluation by default: High-assurance security checks
 *    must evaluate live database state per request.
 * 3. Safe short-TTL opt-in: For high-throughput read endpoints opting into caching,
 *    enforce a strictly bounded short TTL (default: 10 seconds, range 5-15s).
 * 4. Explicit invalidation triggers: Cache MUST be invalidated immediately on:
 *    - User account deactivation / disable (User.isActive -> false)
 *    - PositionAssignment updates / termination / revocation
 *    - PortfolioAssignment updates / reassignments
 *    - DelegationGrant revocation / updates
 * 5. Single-flight promise coalescing: Deduplicates concurrent DB loads
 *    for the same user under load.
 */

import type { AuthorizationContext } from './authorization-context';
import { loadFreshAuthorizationContext } from './authorization-context-service';

export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  invalidations: number;
  evictions: number;
}

export interface CacheOptions {
  ttlMs?: number;
  forceRefresh?: boolean;
}

export interface CacheEntry {
  context: AuthorizationContext;
  cachedAt: number;
  expiresAt: number;
}

export class AuthorizationContextCacheManager {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<AuthorizationContext>>();
  private defaultTtlMs: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;
  private invalidations = 0;
  private evictions = 0;
  private loader: (userId: string, now?: Date) => Promise<AuthorizationContext>;

  constructor(options?: {
    defaultTtlMs?: number;
    maxEntries?: number;
    loader?: (userId: string, now?: Date) => Promise<AuthorizationContext>;
  }) {
    // Short safe default TTL: 10 seconds (within 5-15s range)
    this.defaultTtlMs = options?.defaultTtlMs ?? 10_000;
    this.maxEntries = options?.maxEntries ?? 1_000;
    this.loader = options?.loader ?? loadFreshAuthorizationContext;
  }

  /**
   * Retrieves an AuthorizationContext with optional short-TTL caching.
   *
   * @param userId The user's unique identifier.
   * @param now Optional reference time for deterministic evaluation and time testing.
   * @param options Cache options (ttlMs override, forceRefresh).
   */
  public async getCachedAuthorizationContext(
    userId: string,
    now: Date = new Date(),
    options?: CacheOptions
  ): Promise<AuthorizationContext> {
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const forceRefresh = options?.forceRefresh ?? false;
    const currentTime = now.getTime();

    if (!forceRefresh) {
      const entry = this.cache.get(userId);
      if (entry) {
        if (entry.expiresAt > currentTime) {
          this.hits++;
          return entry.context;
        } else {
          // Stale entry expired by TTL
          this.cache.delete(userId);
          this.evictions++;
        }
      }
    }

    // In-flight promise coalescing / single-flight
    let loadPromise = !forceRefresh ? this.inFlight.get(userId) : undefined;
    if (!loadPromise) {
      this.misses++;
      loadPromise = this.loader(userId, now)
        .then((context) => {
          this.pruneIfNeeded(currentTime);
          this.cache.set(userId, {
            context,
            cachedAt: currentTime,
            expiresAt: currentTime + ttlMs,
          });
          return context;
        })
        .finally(() => {
          this.inFlight.delete(userId);
        });
      this.inFlight.set(userId, loadPromise);
    }

    return loadPromise;
  }

  /**
   * Explicitly invalidates and purges the cached context for a specific user.
   */
  public invalidateAuthorizationContextCache(userId: string): void {
    const existed = this.cache.delete(userId);
    if (existed) {
      this.invalidations++;
    }
    this.inFlight.delete(userId);
  }

  /**
   * Invalidates and clears all cached authorization contexts across the instance.
   */
  public invalidateAllAuthorizationContextCaches(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.inFlight.clear();
    this.invalidations += count;
  }

  /**
   * Returns operational cache metrics for monitoring and observability.
   */
  public getCacheMetrics(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  /**
   * Returns comprehensive metrics including invalidations and evictions.
   */
  public getDetailedMetrics(): CacheMetrics {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      invalidations: this.invalidations,
      evictions: this.evictions,
    };
  }

  /**
   * Resets all metric counters to zero.
   */
  public resetCacheMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
    this.evictions = 0;
  }

  private pruneIfNeeded(currentTime: number): void {
    if (this.cache.size >= this.maxEntries) {
      // 1. Evict any expired entries
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt <= currentTime) {
          this.cache.delete(key);
          this.evictions++;
        }
      }
      // 2. If still at capacity, evict oldest entries (FIFO Map order)
      while (this.cache.size >= this.maxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
          this.cache.delete(oldestKey);
          this.evictions++;
        } else {
          break;
        }
      }
    }
  }
}

// Global singleton cache manager instance
export const authorizationContextCache = new AuthorizationContextCacheManager();

/**
 * Retrieves cached AuthorizationContext for a user, evaluating from database on miss.
 */
export function getCachedAuthorizationContext(
  userId: string,
  now?: Date,
  options?: CacheOptions
): Promise<AuthorizationContext> {
  return authorizationContextCache.getCachedAuthorizationContext(userId, now, options);
}

/**
 * Purges cached context for a specific user.
 */
export function invalidateAuthorizationContextCache(userId: string): void {
  authorizationContextCache.invalidateAuthorizationContextCache(userId);
}

/**
 * Purges all cached contexts across the system.
 */
export function invalidateAllAuthorizationContextCaches(): void {
  authorizationContextCache.invalidateAllAuthorizationContextCaches();
}
