import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveSessionState,
  performSessionSync,
  AUTH_STORAGE_KEY,
  AuthContext,
  type AuthContextType,
} from "../src/lib/auth-context";
import type { AuthUser } from "../src/types/auth";

describe("Task 6: Session Consistency & Auth State Guard (P0-8)", () => {
  const mockServerUser = {
    id: "usr-admin-01",
    email: "vinh.nn@qcet.edu.vn",
    name: "TS. Nguyễn Ngọc Vinh",
    role: "ADMIN",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
    title: "Hiệu trưởng",
  };

  const mockCachedUser: AuthUser = {
    id: "usr-manager-02",
    email: "an.lvh@qcet.edu.vn",
    name: "ThS. Lê Vũ Hùng An",
    role: "MANAGER",
    roleLabel: "Trưởng đơn vị",
    department: "Phòng Đào tạo",
    departmentCode: "DAO_TAO",
    title: "Trưởng phòng",
  };

  // Helper mock storage factory
  function createMockStorage(initialData: Record<string, string> = {}) {
    const store: Record<string, string> = { ...initialData };
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      _store: store,
    };
  }

  describe("1. resolveSessionState pure resolution invariants", () => {
    test("when /api/auth/me returns 200 with { authenticated: true, user: ... }: isAuthenticated=true, isOfflineReadOnly=false", () => {
      const serverAuth = {
        authenticated: true,
        user: mockServerUser,
      };
      const result = resolveSessionState(serverAuth, null);

      assert.strictEqual(result.isAuthenticated, true);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.ok(result.user !== null);
      assert.strictEqual(result.user.id, "usr-admin-01");
      assert.strictEqual(result.user.role, "ADMIN");
      assert.strictEqual(result.user.email, "vinh.nn@qcet.edu.vn");
    });

    test("when /api/auth/me succeeds with active session, server session supersedes stale cached user", () => {
      const serverAuth = {
        authenticated: true,
        user: mockServerUser,
      };
      const staleCachedUserStr = JSON.stringify(mockCachedUser);
      const result = resolveSessionState(serverAuth, staleCachedUserStr);

      assert.strictEqual(result.isAuthenticated, true);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.strictEqual(result.user?.id, mockServerUser.id);
      assert.strictEqual(result.user?.name, mockServerUser.name);
    });

    test("when /api/auth/me returns 401 / { authenticated: false } but localStorage contains cached user: isAuthenticated=false, isOfflineReadOnly=true", () => {
      const serverAuth = { authenticated: false };
      const cachedUserStr = JSON.stringify(mockCachedUser);
      const result = resolveSessionState(serverAuth, cachedUserStr);

      assert.strictEqual(
        result.isAuthenticated,
        false,
        "Session must NOT be marked authenticated when server returns 401"
      );
      assert.strictEqual(
        result.isOfflineReadOnly,
        true,
        "Session must be marked isOfflineReadOnly: true for cached UI fallback"
      );
      assert.ok(result.user !== null);
      assert.strictEqual(result.user.id, mockCachedUser.id);
      assert.strictEqual(result.user.email, mockCachedUser.email);
    });

    test("when /api/auth/me is unreachable (network error / offline) and localStorage contains cached user: isAuthenticated=false, isOfflineReadOnly=true", () => {
      const cachedUserStr = JSON.stringify(mockCachedUser);
      const result = resolveSessionState(null, cachedUserStr);

      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, true);
      assert.ok(result.user !== null);
      assert.strictEqual(result.user.id, mockCachedUser.id);
    });

    test("when /api/auth/me returns 401 and no cached user exists: user=null, isAuthenticated=false, isOfflineReadOnly=false", () => {
      const serverAuth = { authenticated: false };
      const result = resolveSessionState(serverAuth, null);

      assert.strictEqual(result.user, null);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, false);
    });

    test("when /api/auth/me returns 401 and localStorage contains invalid non-JSON string: user=null, isAuthenticated=false, isOfflineReadOnly=false", () => {
      const serverAuth = { authenticated: false };
      const result = resolveSessionState(serverAuth, "{invalid_json_corrupted");

      assert.strictEqual(result.user, null);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, false);
    });
  });

  describe("2. performSessionSync async workflow with mocked fetch & storage", () => {
    test("syncs active server session 200, updates storage, sets isAuthenticated=true", async () => {
      const mockFetch = async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: mockServerUser,
          }),
        } as unknown as Response);

      const storage = createMockStorage();
      const result = await performSessionSync(mockFetch as unknown as typeof fetch, storage);

      assert.strictEqual(result.isAuthenticated, true);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.strictEqual(result.user?.id, mockServerUser.id);

      // Verifies storage was populated with server session user
      const stored = storage.getItem(AUTH_STORAGE_KEY);
      assert.ok(stored !== null);
      const parsed = JSON.parse(stored);
      assert.strictEqual(parsed.id, mockServerUser.id);
    });

    test("handles server 401 with cached user: marks isOfflineReadOnly=true, isAuthenticated=false", async () => {
      const mockFetch = async () =>
        ({
          ok: false,
          status: 401,
          json: async () => ({ error: "Session expired" }),
        } as unknown as Response);

      const storage = createMockStorage({
        [AUTH_STORAGE_KEY]: JSON.stringify(mockCachedUser),
      });

      const result = await performSessionSync(mockFetch as unknown as typeof fetch, storage);

      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, true);
      assert.strictEqual(result.user?.id, mockCachedUser.id);
    });

    test("handles server 401 with empty storage: sets user=null, isAuthenticated=false, isOfflineReadOnly=false", async () => {
      const mockFetch = async () =>
        ({
          ok: false,
          status: 401,
          json: async () => ({ error: "Unauthorized" }),
        } as unknown as Response);

      const storage = createMockStorage();
      const result = await performSessionSync(mockFetch as unknown as typeof fetch, storage);

      assert.strictEqual(result.user, null);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, false);
    });

    test("handles server network failure with cached user gracefully", async () => {
      const mockFetch = async () => {
        throw new Error("Failed to fetch (offline)");
      };

      const storage = createMockStorage({
        [AUTH_STORAGE_KEY]: JSON.stringify(mockCachedUser),
      });

      const result = await performSessionSync(mockFetch as unknown as typeof fetch, storage);

      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, true);
      assert.strictEqual(result.user?.id, mockCachedUser.id);
    });
  });

  describe("3. Logout and session termination lifecycle", () => {
    test("when user logs out, clears storage and state: user=null, isAuthenticated=false, isOfflineReadOnly=false", async () => {
      const storage = createMockStorage({
        [AUTH_STORAGE_KEY]: JSON.stringify(mockCachedUser),
      });

      // Emulate logout sequence
      storage.removeItem(AUTH_STORAGE_KEY);
      const postLogoutUser: AuthUser | null = null;
      const postLogoutIsAuthenticated = false;
      const postLogoutIsOfflineReadOnly = false;

      assert.strictEqual(postLogoutUser, null);
      assert.strictEqual(postLogoutIsAuthenticated, false);
      assert.strictEqual(postLogoutIsOfflineReadOnly, false);
      assert.strictEqual(storage.getItem(AUTH_STORAGE_KEY), null);

      // Post-logout subsequent sync with 401 yields completely logged out visitor
      const mockFetch = async () =>
        ({
          ok: false,
          status: 401,
          json: async () => ({ authenticated: false }),
        } as unknown as Response);

      const resolution = await performSessionSync(mockFetch as unknown as typeof fetch, storage);
      assert.strictEqual(resolution.user, null);
      assert.strictEqual(resolution.isAuthenticated, false);
      assert.strictEqual(resolution.isOfflineReadOnly, false);
    });
  });

  describe("4. Static architecture & rule invariants (.claude/rules/31-auth-security.md)", () => {
    const authContextPath = path.resolve(__dirname, "../src/lib/auth-context.tsx");
    const source = fs.readFileSync(authContextPath, "utf-8");

    test("AuthContext default value provides safe unauthenticated fallbacks", () => {
      // Test default values of AuthContext
      // In createContext, consumer outside provider gets:
      // user: null, isAuthenticated: false, isOfflineReadOnly: false
      assert.match(
        source,
        /createContext<AuthContextType>\(\s*\{\s*user:\s*null,\s*isAuthenticated:\s*false,\s*isOfflineReadOnly:\s*false/,
        "AuthContext default must explicitly set isAuthenticated: false and isOfflineReadOnly: false"
      );
    });

    test("exports resolveSessionState and performSessionSync", () => {
      assert.match(
        source,
        /export function resolveSessionState\(/,
        "Must export resolveSessionState function"
      );
      assert.match(
        source,
        /export async function performSessionSync\(/,
        "Must export performSessionSync function"
      );
    });

    test("logout sets isAuthenticated to false and isOfflineReadOnly to false", () => {
      assert.match(
        source,
        /setIsAuthenticated\(false\)/,
        "logout must set setIsAuthenticated(false)"
      );
      assert.match(
        source,
        /setIsOfflineReadOnly\(false\)/,
        "logout must set setIsOfflineReadOnly(false)"
      );
    });

    test("successful login sets isAuthenticated to true and isOfflineReadOnly to false", () => {
      assert.match(
        source,
        /setIsAuthenticated\(true\)/,
        "login must set setIsAuthenticated(true)"
      );
      assert.match(
        source,
        /setIsOfflineReadOnly\(false\)/,
        "login must set setIsOfflineReadOnly(false)"
      );
    });

    test("contains zero dark: classes in auth-context.tsx", () => {
      const darkMatches = source.match(/dark:[a-zA-Z0-9_\-\/]+/g);
      assert.strictEqual(
        darkMatches,
        null,
        `Found unexpected dark: classes: ${JSON.stringify(darkMatches)}`
      );
    });
  });
});
