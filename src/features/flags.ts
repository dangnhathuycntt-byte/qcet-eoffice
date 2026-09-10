/**
 * QCET E-Office - Feature Flags & Operational Kill Switches
 *
 * ============================================================================
 * CRITICAL ARCHITECTURAL INVARIANT:
 * Feature Flag != Authorization / Permission!
 *
 * - Feature Flags control operational system availability, 3rd-party outage
 *   circuit breaking, and staged feature rollouts across the institution.
 * - Authorization (RBAC / Scope) controls whether a specific authenticated
 *   user has the authority to view, mutate, approve, or sign off an entity.
 *
 * NEVER substitute an RBAC check (e.g., canApproveTask, isDepartmentHead)
 * with a feature flag check. Feature flags MUST only gate whether an entire
 * technical capability or integration is active in this deployment.
 * ============================================================================
 */

export type FeatureFlagKey =
  | "pushNotifications"
  | "externalGoogleLogin"
  | "offlineMutations"
  | "largeExcelExport"
  | "taskWorkspaceV2"
  | "mobileAgenda"
  | "newExecutiveDashboard";

export interface FeatureFlagDefinition {
  readonly key: FeatureFlagKey;
  readonly description: string;
  readonly defaultValue: boolean;
  readonly isKillSwitch: boolean;
  readonly isPublic: boolean;
}

export const FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  pushNotifications: {
    key: "pushNotifications",
    description: "Operational kill switch for Web Push notifications (service worker dispatches)",
    defaultValue: true,
    isKillSwitch: true,
    isPublic: true,
  },
  externalGoogleLogin: {
    key: "externalGoogleLogin",
    description: "Operational kill switch for Google OAuth authentication callback & redirect",
    defaultValue: true,
    isKillSwitch: true,
    isPublic: true,
  },
  offlineMutations: {
    key: "offlineMutations",
    description: "Operational kill switch for background offline mutation queuing and outbox sync",
    defaultValue: true,
    isKillSwitch: true,
    isPublic: true,
  },
  largeExcelExport: {
    key: "largeExcelExport",
    description: "Operational kill switch for generating and streaming heavy Excel/CSV workbook exports",
    defaultValue: true,
    isKillSwitch: true,
    isPublic: true,
  },
  taskWorkspaceV2: {
    key: "taskWorkspaceV2",
    description: "Phased rollout flag for Task Workspace V2 layout and interaction engine",
    defaultValue: false,
    isKillSwitch: false,
    isPublic: true,
  },
  mobileAgenda: {
    key: "mobileAgenda",
    description: "Phased rollout flag for mobile-optimized daily agenda and personal timeline view",
    defaultValue: false,
    isKillSwitch: false,
    isPublic: true,
  },
  newExecutiveDashboard: {
    key: "newExecutiveDashboard",
    description: "Phased rollout flag for the new executive multi-unit cross-department analytics dashboard",
    defaultValue: false,
    isKillSwitch: false,
    isPublic: true,
  },
};

/**
 * Converts camelCase to UPPER_SNAKE_CASE (e.g. pushNotifications -> PUSH_NOTIFICATIONS).
 */
export function toSnakeCaseUpper(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_/, "")
    .toUpperCase();
}

/**
 * Parses a string or boolean representation into a boolean value.
 * Supports: true, 1, yes, on, enabled vs. false, 0, no, off, disabled.
 */
export function parseBooleanFlag(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const trimmed = val.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(trimmed)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(trimmed)) return false;
  }
  return undefined;
}

/**
 * Resolves candidate environment variable names for a given flag key.
 */
export function getEnvVariableNamesForFlag(key: string): string[] {
  const upperSnake = toSnakeCaseUpper(key);
  return [
    `FEATURE_FLAG_${upperSnake}`,
    `FEATURE_${upperSnake}`,
    `FEATURE_FLAG_${key}`,
    `FEATURE_${key}`,
    `NEXT_PUBLIC_FEATURE_FLAG_${upperSnake}`,
    `NEXT_PUBLIC_FEATURE_${upperSnake}`,
  ];
}

// In-memory dynamic overrides (useful for testing, dev experimentation, or live operational overrides)
const runtimeOverrides = new Map<FeatureFlagKey, boolean>();

/**
 * Sets a dynamic runtime override for a feature flag.
 * Pass undefined to remove the override and revert to env / default.
 */
export function setFeatureFlagOverride(key: FeatureFlagKey, enabled: boolean | undefined): void {
  if (enabled === undefined) {
    runtimeOverrides.delete(key);
  } else {
    runtimeOverrides.set(key, enabled);
  }
}

/**
 * Clears all active runtime overrides.
 */
export function resetFeatureFlagOverrides(): void {
  runtimeOverrides.clear();
}

/**
 * Returns all active runtime overrides.
 */
export function getFeatureFlagOverrides(): Partial<Record<FeatureFlagKey, boolean>> {
  const overrides: Partial<Record<FeatureFlagKey, boolean>> = {};
  for (const [k, v] of runtimeOverrides.entries()) {
    overrides[k] = v;
  }
  return overrides;
}

/**
 * Isomorphic environment getter that safely runs in server, worker, or browser environments.
 */
function getEnvValue(name: string): string | undefined {
  if (typeof process !== "undefined" && process?.env) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Evaluates whether a feature flag is enabled.
 *
 * Precedence:
 * 1. Runtime in-memory override (highest)
 * 2. Environment variable override (FEATURE_FLAG_* / FEATURE_*)
 * 3. Default definition in FEATURE_FLAGS
 *
 * If flagKey is unknown or invalid, safely returns false.
 */
export function isFeatureEnabled(flagKey: FeatureFlagKey): boolean {
  if (!flagKey || !(flagKey in FEATURE_FLAGS)) {
    return false;
  }

  // 1. Runtime override
  if (runtimeOverrides.has(flagKey)) {
    return runtimeOverrides.get(flagKey)!;
  }

  // 2. Environment variable overrides
  const envCandidates = getEnvVariableNamesForFlag(flagKey);
  for (const envName of envCandidates) {
    const rawVal = getEnvValue(envName);
    const parsed = parseBooleanFlag(rawVal);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  // 3. Static default
  return FEATURE_FLAGS[flagKey].defaultValue;
}

/**
 * Returns an evaluated dictionary of all defined feature flags.
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const result: Record<FeatureFlagKey, boolean> = {} as Record<FeatureFlagKey, boolean>;
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    result[key] = isFeatureEnabled(key);
  }
  return result;
}

/**
 * Returns an evaluated dictionary of flags safe for client consumption.
 * Ensures strict isolation: no secrets, only boolean states.
 */
export function getPublicFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const result: Record<FeatureFlagKey, boolean> = {} as Record<FeatureFlagKey, boolean>;
  for (const [key, def] of Object.entries(FEATURE_FLAGS) as [FeatureFlagKey, FeatureFlagDefinition][]) {
    if (def.isPublic) {
      result[key] = isFeatureEnabled(key);
    }
  }
  return result;
}
