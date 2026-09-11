/**
 * Dashboard Scope Invariants Test Suite (Phase 0 / Regression Lock)
 * Target: Workspace & Dashboard Scope Resolution
 * Invariants: DASH-03 (Role Is Not Scope), DASH-09 (Server Truth Wins)
 * Rule 05-domain-freeze: TaskScope is visual display only, never permission model
 *
 * Requirements:
 * 1. Prohibit role directly deciding active scope (Role Is Not Scope invariant)
 * 2. Disallow school scope for users whose server viewScopes does not include SCHOOL
 * 3. Assert scope resolution relies on allowedScopes/viewScopes from server context
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

export type ServerViewScope = "PERSONAL" | "UNIT" | "SCHOOL";
export type NormalizedScope = "personal" | "unit" | "school";

export interface ServerAuthScopeContext {
  userId: string;
  role?: string;
  viewScopes: readonly ServerViewScope[];
  primaryUnitId?: string | null;
}

export interface ScopeResolutionResult {
  effectiveScope: NormalizedScope;
  isDowngraded: boolean;
  reason?: string;
}

/**
 * Canonical scope resolution function adhering unconditionally to "Role Is Not Scope".
 * Server viewScopes is authoritative. Role cannot bypass or dictate dataset scope.
 */
export function resolveCanonicalDashboardScope(params: {
  requestedScope?: string | null;
  serverContext: ServerAuthScopeContext;
  defaultScope?: NormalizedScope;
}): ScopeResolutionResult {
  const { requestedScope, serverContext, defaultScope = "personal" } = params;
  const allowed = new Set<ServerViewScope>(serverContext.viewScopes || ["PERSONAL"]);

  // Normalize requested scope input
  let normalizedRequested: NormalizedScope | null = null;
  if (requestedScope) {
    const lower = requestedScope.toLowerCase().trim();
    if (lower === "school" || lower === "school_tasks") {
      normalizedRequested = "school";
    } else if (lower === "unit" || lower === "unit_tasks" || lower === "department") {
      normalizedRequested = "unit";
    } else if (lower === "personal" || lower === "my" || lower === "my_tasks") {
      normalizedRequested = "personal";
    }
  }

  // If no scope requested, determine best authorized default based strictly on viewScopes (NOT role)
  if (!normalizedRequested) {
    if (defaultScope === "school" && allowed.has("SCHOOL")) {
      return { effectiveScope: "school", isDowngraded: false };
    }
    if (defaultScope === "unit" && allowed.has("UNIT")) {
      return { effectiveScope: "unit", isDowngraded: false };
    }
    // Highest authorized scope available, or fallback to personal
    if (allowed.has("SCHOOL")) return { effectiveScope: "school", isDowngraded: false };
    if (allowed.has("UNIT")) return { effectiveScope: "unit", isDowngraded: false };
    return { effectiveScope: "personal", isDowngraded: false };
  }

  // Map normalized requested scope to ServerViewScope
  const scopeMap: Record<NormalizedScope, ServerViewScope> = {
    school: "SCHOOL",
    unit: "UNIT",
    personal: "PERSONAL",
  };

  const requiredViewScope = scopeMap[normalizedRequested];

  // Verify against server truth
  if (allowed.has(requiredViewScope)) {
    return { effectiveScope: normalizedRequested, isDowngraded: false };
  }

  // Downgrade to highest allowed scope
  let fallback: NormalizedScope = "personal";
  if (allowed.has("UNIT")) {
    fallback = "unit";
  }

  return {
    effectiveScope: fallback,
    isDowngraded: true,
    reason: `Requested scope "${normalizedRequested}" disallowed: server viewScopes does not include ${requiredViewScope}`,
  };
}

describe("Dashboard Scope Invariants (Role Is Not Scope)", () => {
  test("1. Prohibit role directly deciding active scope (Role Is Not Scope invariant)", () => {
    // Case A: User has role ADMIN/RECTOR, but server viewScopes only includes PERSONAL
    // (e.g. personal inbox view mode or restricted session)
    const executiveWithPersonalOnly: ServerAuthScopeContext = {
      userId: "usr-rector-01",
      role: "RECTOR", // Authority role
      viewScopes: ["PERSONAL"], // Server dataset filter constraint
    };

    const resultA = resolveCanonicalDashboardScope({
      requestedScope: "school",
      serverContext: executiveWithPersonalOnly,
    });

    assert.equal(
      resultA.effectiveScope,
      "personal",
      "Role RECTOR must NOT bypass server viewScopes: active scope must be downgraded to personal"
    );
    assert.equal(resultA.isDowngraded, true);

    // Case B: User has role STAFF/SPECIALIST, but has been granted delegated access with SCHOOL in viewScopes
    const specialistWithDelegation: ServerAuthScopeContext = {
      userId: "usr-staff-01",
      role: "STAFF",
      viewScopes: ["PERSONAL", "UNIT", "SCHOOL"],
    };

    const resultB = resolveCanonicalDashboardScope({
      requestedScope: "school",
      serverContext: specialistWithDelegation,
    });

    assert.equal(
      resultB.effectiveScope,
      "school",
      "User with STAFF role but authorized SCHOOL viewScopes must be granted school scope"
    );
    assert.equal(resultB.isDowngraded, false);

    // Case C: Role string alone without viewScopes cannot grant SCHOOL scope
    const arbitraryRoleUser: ServerAuthScopeContext = {
      userId: "usr-custom-01",
      role: "SYSTEM_ADMIN",
      viewScopes: ["PERSONAL", "UNIT"], // Missing SCHOOL
    };

    const resultC = resolveCanonicalDashboardScope({
      requestedScope: "school",
      serverContext: arbitraryRoleUser,
    });

    assert.equal(
      resultC.effectiveScope,
      "unit",
      "SYSTEM_ADMIN without SCHOOL in viewScopes cannot access school dataset filter"
    );
  });

  test("2. Disallow school scope for users whose server viewScopes does not include SCHOOL", () => {
    // Department Dean (Trưởng phòng / Trưởng khoa)
    const deanContext: ServerAuthScopeContext = {
      userId: "usr-dean-it",
      role: "DEAN",
      viewScopes: ["PERSONAL", "UNIT"],
      primaryUnitId: "DEPT_CNTT",
    };

    // Dean attempts to select school scope (?scope=school)
    const deanSchoolRequest = resolveCanonicalDashboardScope({
      requestedScope: "school",
      serverContext: deanContext,
    });

    assert.equal(
      deanSchoolRequest.effectiveScope,
      "unit",
      "Dean without SCHOOL viewScopes must be downgraded to unit scope"
    );
    assert.equal(deanSchoolRequest.isDowngraded, true);
    assert.match(deanSchoolRequest.reason || "", /server viewScopes does not include SCHOOL/);

    // Specialist / Faculty Lecturer
    const lecturerContext: ServerAuthScopeContext = {
      userId: "usr-lecturer-01",
      role: "LECTURER",
      viewScopes: ["PERSONAL"],
    };

    const lecturerSchoolRequest = resolveCanonicalDashboardScope({
      requestedScope: "school",
      serverContext: lecturerContext,
    });

    assert.equal(
      lecturerSchoolRequest.effectiveScope,
      "personal",
      "Lecturer requesting school scope must be downgraded to personal"
    );
    assert.equal(lecturerSchoolRequest.isDowngraded, true);
  });

  test("3. Assert scope resolution relies on allowedScopes/viewScopes from server context", () => {
    const fullAccessContext: ServerAuthScopeContext = {
      userId: "usr-bgh-01",
      viewScopes: ["PERSONAL", "UNIT", "SCHOOL"],
    };

    // Valid requests match server viewScopes exactly
    assert.equal(
      resolveCanonicalDashboardScope({ requestedScope: "school", serverContext: fullAccessContext }).effectiveScope,
      "school"
    );
    assert.equal(
      resolveCanonicalDashboardScope({ requestedScope: "unit", serverContext: fullAccessContext }).effectiveScope,
      "unit"
    );
    assert.equal(
      resolveCanonicalDashboardScope({ requestedScope: "personal", serverContext: fullAccessContext }).effectiveScope,
      "personal"
    );
    assert.equal(
      resolveCanonicalDashboardScope({ requestedScope: "my", serverContext: fullAccessContext }).effectiveScope,
      "personal"
    );

    // Default scope without explicit request uses highest authorized from server viewScopes
    const defaultResolution = resolveCanonicalDashboardScope({
      requestedScope: undefined,
      serverContext: fullAccessContext,
    });
    assert.equal(defaultResolution.effectiveScope, "school");

    // Unit-only user default scope is unit
    const unitOnlyContext: ServerAuthScopeContext = {
      userId: "usr-unit-mgr",
      viewScopes: ["PERSONAL", "UNIT"],
    };
    const unitDefault = resolveCanonicalDashboardScope({
      requestedScope: undefined,
      serverContext: unitOnlyContext,
    });
    assert.equal(unitDefault.effectiveScope, "unit");

    // Personal-only user default scope is personal
    const personalOnlyContext: ServerAuthScopeContext = {
      userId: "usr-individual",
      viewScopes: ["PERSONAL"],
    };
    const personalDefault = resolveCanonicalDashboardScope({
      requestedScope: undefined,
      serverContext: personalOnlyContext,
    });
    assert.equal(personalDefault.effectiveScope, "personal");
  });
});
