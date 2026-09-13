/**
 * A tiny "latest request wins" guard (plan T03.6).
 *
 * When two dashboard fetches are in flight, a slow earlier response must never
 * overwrite a later one. The hook calls `begin()` before a fetch and only commits
 * the payload when `isCurrent(token)` is still true. No state library involved.
 */
export interface LatestRequestGuard {
  /** Start a new request and return its token. */
  begin(): number;
  /** Is this token still the most recent one to have started? */
  isCurrent(token: number): boolean;
  /** The most recent token (0 before the first request). */
  current(): number;
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latest = 0;
  return {
    begin() {
      return ++latest;
    },
    isCurrent(token: number) {
      return token === latest;
    },
    current() {
      return latest;
    },
  };
}
