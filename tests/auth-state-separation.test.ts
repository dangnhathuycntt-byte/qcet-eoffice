import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as meGet } from "../src/app/api/auth/me/route";
import { prisma } from "../src/lib/prisma";
import { SESSION_COOKIE_NAME, signSessionToken } from "../src/lib/jwt-session";
import {
  resolveSessionState,
  performSessionSync,
  AUTH_STORAGE_KEY,
  assertCanMutate,
} from "../src/lib/auth-context";
import type {
  AuthState,
  CachedUser,
  DemoIdentity,
  AuthUser,
} from "../src/types/auth";

describe("Phase 8: Auth & Session Truth State Separation (P0-8)", () => {
  const mockServerUser = {
    id: "usr-admin-01",
    email: "vinh.nn@qcet.edu.vn",
    name: "TS. Nguyễn Ngọc Vinh",
    role: "ADMIN",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
    title: "Hiệu trưởng",
  };

  const mockCachedUser: CachedUser = {
    id: "usr-manager-02",
    email: "an.lvh@qcet.edu.vn",
    name: "ThS. Lê Vũ Hùng An",
    role: "MANAGER",
    roleLabel: "Trưởng đơn vị",
    department: "Phòng Đào tạo",
    departmentCode: "DAO_TAO",
    title: "Trưởng phòng",
    cachedAt: new Date().toISOString(),
    isOfflineCached: true,
  };

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

  // ==========================================================================
  // SUITE 1: Strong typing & structural invariants
  // ==========================================================================
  describe("1. Type structure and invariants of AuthState, CachedUser, DemoIdentity", () => {
    test("AuthState cleanly discriminates 4 lifecycle statuses", () => {
      const authStateAuthenticated: AuthState = {
        status: "authenticated",
        user: {
          id: "u-1",
          email: "test@qcet.edu.vn",
          name: "Test User",
          role: "ADMIN",
          roleLabel: "Ban Giám hiệu",
          department: "BGH",
          departmentCode: "BGH",
          title: "Hiệu trưởng",
        },
      };

      const authStateOffline: AuthState = {
        status: "offline-cached",
        user: mockCachedUser,
      };

      const authStateAnonymous: AuthState = {
        status: "anonymous",
      };

      const authStateLoading: AuthState = {
        status: "loading",
      };

      assert.strictEqual(authStateAuthenticated.status, "authenticated");
      assert.strictEqual(authStateOffline.status, "offline-cached");
      assert.strictEqual(authStateAnonymous.status, "anonymous");
      assert.strictEqual(authStateLoading.status, "loading");
    });

    test("CachedUser contains required identity fields and explicit offline metadata", () => {
      const cached: CachedUser = {
        id: "u-cache-99",
        name: "Nguyễn Văn A",
        email: "a.nv@qcet.edu.vn",
        role: "STAFF",
        roleLabel: "Chuyên viên",
        department: "Phòng Hành chính - Tổng hợp",
        departmentCode: "HCTH",
        title: "Chuyên viên văn thư",
        cachedAt: "2026-09-09T00:00:00.000Z",
        isOfflineCached: true,
      };

      assert.strictEqual(cached.isOfflineCached, true);
      assert.ok(cached.cachedAt);
      assert.strictEqual(cached.id, "u-cache-99");
      assert.strictEqual(cached.role, "STAFF");
    });

    test("DemoIdentity designates demo persona with role authority", () => {
      const demo: DemoIdentity = {
        id: "demo-bgh",
        name: "TS. Nguyễn Văn Hiệu (Demo)",
        email: "bgh@qcet.edu.vn",
        role: "ADMIN",
        roleLabel: "Ban Giám hiệu",
        department: "Ban Giám hiệu",
        departmentCode: "BGH",
        title: "Hiệu trưởng",
        isDemo: true,
      };

      assert.strictEqual(demo.isDemo, true);
      assert.strictEqual(demo.role, "ADMIN");
      assert.strictEqual(demo.email, "bgh@qcet.edu.vn");
    });
  });

  // ==========================================================================
  // SUITE 2: resolveSessionState -> Authenticated status
  // ==========================================================================
  describe("2. resolveSessionState returns authenticated with canMutate: true for valid server session", () => {
    test("when server session 200 is present: status=authenticated, canMutate=true, isAuthenticated=true, isOfflineReadOnly=false", () => {
      const serverAuth = {
        authenticated: true,
        user: mockServerUser,
      };
      const result = resolveSessionState(serverAuth, null);

      assert.strictEqual(result.state.status, "authenticated");
      assert.strictEqual(result.canMutate, true);
      assert.strictEqual(result.isAuthenticated, true);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.strictEqual(result.user?.id, "usr-admin-01");
      assert.strictEqual(result.user?.email, "vinh.nn@qcet.edu.vn");
    });

    test("server session truth unconditionally supersedes stale cached user", () => {
      const serverAuth = {
        authenticated: true,
        user: mockServerUser,
      };
      const result = resolveSessionState(serverAuth, JSON.stringify(mockCachedUser));

      assert.strictEqual(result.state.status, "authenticated");
      assert.strictEqual(result.canMutate, true);
      assert.strictEqual(result.user?.id, "usr-admin-01");
      assert.strictEqual(result.user?.email, "vinh.nn@qcet.edu.vn");
      assert.strictEqual(result.isAuthenticated, true);
      assert.strictEqual(result.isOfflineReadOnly, false);
    });
  });

  // ==========================================================================
  // SUITE 3: resolveSessionState -> Offline-cached status
  // ==========================================================================
  describe("3. resolveSessionState returns offline-cached with canMutate: false when server is 401/unreachable and cached user exists", () => {
    test("when server returns 401 / unauthenticated and cached user exists: status=offline-cached, canMutate=false, isOfflineReadOnly=true", () => {
      const serverAuth = { authenticated: false, user: null };
      const result = resolveSessionState(serverAuth, JSON.stringify(mockCachedUser));

      assert.strictEqual(result.state.status, "offline-cached");
      assert.strictEqual(result.canMutate, false);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, true);
      assert.strictEqual(result.user?.id, "usr-manager-02");
      assert.strictEqual((result.user as CachedUser).isOfflineCached, true);
    });

    test("when server is unreachable (null response) and cached user exists: status=offline-cached, canMutate=false", () => {
      const result = resolveSessionState(null, JSON.stringify(mockCachedUser));

      assert.strictEqual(result.state.status, "offline-cached");
      assert.strictEqual(result.canMutate, false);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, true);
      assert.strictEqual(result.user?.id, "usr-manager-02");
    });
  });

  // ==========================================================================
  // SUITE 4: resolveSessionState -> Anonymous status
  // ==========================================================================
  describe("4. resolveSessionState returns anonymous with canMutate: false when no session and no cached user", () => {
    test("when server returns 401 and no cached user: status=anonymous, canMutate=false, user=null", () => {
      const serverAuth = { authenticated: false, user: null };
      const result = resolveSessionState(serverAuth, null);

      assert.strictEqual(result.state.status, "anonymous");
      assert.strictEqual(result.canMutate, false);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.strictEqual(result.user, null);
    });

    test("when server is unreachable and no cached user: status=anonymous, canMutate=false, user=null", () => {
      const result = resolveSessionState(null, null);

      assert.strictEqual(result.state.status, "anonymous");
      assert.strictEqual(result.canMutate, false);
      assert.strictEqual(result.isAuthenticated, false);
      assert.strictEqual(result.isOfflineReadOnly, false);
      assert.strictEqual(result.user, null);
    });
  });

  // ==========================================================================
  // SUITE 5: performSessionSync end-to-end integration
  // ==========================================================================
  describe("5. performSessionSync integration with mock fetch and localStorage", () => {
    test("active server session sets state authenticated, saves to storage, and enables mutation", async () => {
      const storage = createMockStorage();
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: true,
          user: mockServerUser,
        }),
      });

      const resolution = await performSessionSync(mockFetch as unknown as typeof fetch, storage);
      assert.strictEqual(resolution.state.status, "authenticated");
      assert.strictEqual(resolution.canMutate, true);
      assert.strictEqual(resolution.isAuthenticated, true);
      assert.strictEqual(resolution.isOfflineReadOnly, false);

      const saved = JSON.parse(storage.getItem(AUTH_STORAGE_KEY)!);
      assert.strictEqual(saved.id, mockServerUser.id);
    });

    test("server 401 with cached user sets state offline-cached and disables mutation", async () => {
      const storage = createMockStorage({
        [AUTH_STORAGE_KEY]: JSON.stringify(mockCachedUser),
      });
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ authenticated: false, user: null }),
      });

      const resolution = await performSessionSync(mockFetch as unknown as typeof fetch, storage);
      assert.strictEqual(resolution.state.status, "offline-cached");
      assert.strictEqual(resolution.canMutate, false);
      assert.strictEqual(resolution.isAuthenticated, false);
      assert.strictEqual(resolution.isOfflineReadOnly, true);
      assert.strictEqual(resolution.user?.id, mockCachedUser.id);
    });

    test("network error with cached user gracefully falls back to offline-cached with canMutate=false", async () => {
      const storage = createMockStorage({
        [AUTH_STORAGE_KEY]: JSON.stringify(mockCachedUser),
      });
      const mockFetch = async () => {
        throw new Error("Network offline");
      };

      const resolution = await performSessionSync(mockFetch as unknown as typeof fetch, storage);
      assert.strictEqual(resolution.state.status, "offline-cached");
      assert.strictEqual(resolution.canMutate, false);
      assert.strictEqual(resolution.isAuthenticated, false);
      assert.strictEqual(resolution.isOfflineReadOnly, true);
    });

    test("server 401 with empty storage produces anonymous state with canMutate=false", async () => {
      const storage = createMockStorage();
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ authenticated: false, user: null }),
      });

      const resolution = await performSessionSync(mockFetch as unknown as typeof fetch, storage);
      assert.strictEqual(resolution.state.status, "anonymous");
      assert.strictEqual(resolution.canMutate, false);
      assert.strictEqual(resolution.user, null);
    });
  });

  // ==========================================================================
  // SUITE 6: GET /api/auth/me Cookie & Bearer Token Verification
  // ==========================================================================
  describe("6. GET /api/auth/me verifies both Cookie and Authorization: Bearer <token>", () => {
    let testSessionToken: string;
    let seededUserId: string;

    before(async () => {
      // Find or create an active user in DB
      let user = await prisma.user.findFirst({
        where: { isActive: true },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `test_user_${Date.now()}@qcet.edu.vn`,
            name: "Người dùng Thử nghiệm",
            role: "CHUYEN_VIEN",
            isActive: true,
          },
        });
      }
      seededUserId = user.id;

      // Sign JWT session token
      testSessionToken = signSessionToken({
        id: seededUserId,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    });

    test("GET /api/auth/me returns unauthenticated when neither cookie nor Authorization header is provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/me");
      const res = await meGet(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.authenticated, false);
      assert.strictEqual(json.user, null);
    });

    test("GET /api/auth/me verifies authenticated session via Cookie (qcet_session)", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${testSessionToken}`,
        },
      });
      const res = await meGet(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.authenticated, true);
      assert.ok(json.user);
      assert.strictEqual(json.user.id, seededUserId);
    });

    test("GET /api/auth/me verifies authenticated session via Authorization: Bearer <token>", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          authorization: `Bearer ${testSessionToken}`,
        },
      });
      const res = await meGet(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.authenticated, true);
      assert.ok(json.user);
      assert.strictEqual(json.user.id, seededUserId);
    });

    test("GET /api/auth/me returns unauthenticated on tampered or nonexistent Bearer token", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          authorization: "Bearer invalid.tampered.token.12345",
        },
      });
      const res = await meGet(req);
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.authenticated, false);
      assert.strictEqual(json.user, null);
    });
  });

  // ==========================================================================
  // SUITE 7: Mutation Guard & Server Session Truth Enforcement
  // ==========================================================================
  describe("7. Mutation guard enforcement (Server Session Truth)", () => {
    test("assertCanMutate throws when session is in offline-cached state", () => {
      const offlineState: AuthState = {
        status: "offline-cached",
        user: mockCachedUser,
      };

      assert.throws(
        () => assertCanMutate(false, offlineState),
        (err: Error) => {
          assert.strictEqual(
            err.message,
            "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)"
          );
          return true;
        }
      );
    });

    test("assertCanMutate throws when session is in anonymous state", () => {
      const anonymousState: AuthState = {
        status: "anonymous",
      };

      assert.throws(
        () => assertCanMutate(false, anonymousState),
        (err: Error) => {
          assert.strictEqual(
            err.message,
            "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)"
          );
          return true;
        }
      );
    });

    test("assertCanMutate throws when session is in loading state", () => {
      const loadingState: AuthState = {
        status: "loading",
      };

      assert.throws(
        () => assertCanMutate(false, loadingState),
        (err: Error) => {
          assert.strictEqual(
            err.message,
            "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)"
          );
          return true;
        }
      );
    });

    test("assertCanMutate throws if canMutate is true but authState is offline-cached (tampered client state)", () => {
      const offlineState: AuthState = {
        status: "offline-cached",
        user: mockCachedUser,
      };

      assert.throws(
        () => assertCanMutate(true, offlineState),
        (err: Error) => {
          assert.strictEqual(
            err.message,
            "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)"
          );
          return true;
        }
      );
    });

    test("assertCanMutate throws if canMutate is false even if status is authenticated", () => {
      const authenticatedState: AuthState = {
        status: "authenticated",
        user: {
          id: "usr-admin-01",
          email: "vinh.nn@qcet.edu.vn",
          name: "TS. Nguyễn Ngọc Vinh",
          role: "ADMIN",
          roleLabel: "Ban Giám hiệu",
          department: "BGH",
          departmentCode: "BGH",
          title: "Hiệu trưởng",
        },
      };

      assert.throws(
        () => assertCanMutate(false, authenticatedState),
        (err: Error) => {
          assert.strictEqual(
            err.message,
            "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)"
          );
          return true;
        }
      );
    });

    test("assertCanMutate succeeds without throwing for valid authenticated session with canMutate=true", () => {
      const authenticatedState: AuthState = {
        status: "authenticated",
        user: {
          id: "usr-admin-01",
          email: "vinh.nn@qcet.edu.vn",
          name: "TS. Nguyễn Ngọc Vinh",
          role: "ADMIN",
          roleLabel: "Ban Giám hiệu",
          department: "BGH",
          departmentCode: "BGH",
          title: "Hiệu trưởng",
        },
      };

      assert.doesNotThrow(() => assertCanMutate(true, authenticatedState));
    });
  });
});
