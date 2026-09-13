"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { AuthUser, CachedUser, UserRole, OnboardingData, AuthState } from "../types/auth";
import { purgeUserOfflineData } from "./pwa/offline-store";

export const AUTH_STORAGE_KEY = "qcet_active_user";
export const REGISTERED_USERS_KEY = "qcet_registered_users";

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  departmentId?: string;
  title?: string;
  role?: string;
}

export interface AuthContextType {
  user: AuthUser | CachedUser | null;
  isAuthenticated: boolean;
  isOfflineReadOnly: boolean;
  authState: AuthState;
  canMutate: boolean;
  switchRole: (role: UserRole) => void;
  switchUser: (userId: string) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  register: (data: RegisterPayload) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  /**
   * @deprecated Google login is handled via server OAuth at /api/auth/google.
   */
  loginWithGoogle: (payload?: {
    email?: string;
    name?: string;
    avatar?: string;
  }) => AuthUser;
  updateProfile: (
    updates: Partial<AuthUser>
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  logout: () => Promise<void>;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  isLoading?: boolean;
}

export function mapDbUserToAuthUser(dbUser: {
  id?: string;
  email: string;
  name: string;
  role?: string;
  departmentId?: string | null;
  department?: { name?: string; shortName?: string | null } | null;
  title?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  phone?: string | null;
  provider?: string | null;
  onboardedAt?: Date | string | null;
  onboardingData?: OnboardingData | any | null;
}): AuthUser {
  const roleStr = String(dbUser.role || "").toUpperCase();
  let role: UserRole = "STAFF";
  let roleLabel = "Chuyên viên";

  if (roleStr === "BAN_GIAM_HIEU" || roleStr === "ADMIN") {
    role = "ADMIN";
    roleLabel = "Ban Giám hiệu";
  } else if (roleStr === "TRUONG_PHONG" || roleStr === "MANAGER") {
    role = "MANAGER";
    roleLabel = "Trưởng đơn vị";
  } else {
    role = "STAFF";
    roleLabel = "Chuyên viên";
  }

  return {
    id: dbUser.id || `user-${Date.now()}`,
    name: dbUser.name || "Cán bộ QCET",
    email: dbUser.email,
    role,
    roleLabel,
    department:
      dbUser.department?.name ||
      (dbUser.departmentId === "BGH"
        ? "Ban Giám hiệu Nhà trường"
        : dbUser.departmentId === "CNTT"
        ? "Phòng Quản trị Mạng và CNTT"
        : dbUser.departmentId === "TCHC"
        ? "Phòng Tổ chức Hành chính"
        : dbUser.departmentId === "KHTC"
        ? "Phòng Kế hoạch Tài chính"
        : dbUser.departmentId === "DT_QLKH"
        ? "Phòng Đào tạo & Quản lý Khoa học"
        : "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"),
    departmentCode: dbUser.departmentId || "QCET",
    title: dbUser.title || roleLabel,
    avatar: dbUser.avatarUrl || dbUser.avatar || undefined,
    phone: dbUser.phone || undefined,
    isFirstLogin: false,
    emailVerified: true,
    provider: (dbUser.provider as "google" | "demo" | "system") || "system",
    dbRole: dbUser.role,
    onboardedAt: dbUser.onboardedAt
      ? typeof dbUser.onboardedAt === "string"
        ? dbUser.onboardedAt
        : dbUser.onboardedAt.toISOString()
      : null,
    onboardingData: (dbUser.onboardingData as OnboardingData) || null,
  };
}

export function isUserUnassignedDepartment(
  user?: { role?: string; department?: string | null; departmentCode?: string | null } | null
): boolean {
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  const isExecutive =
    role === "ADMIN" ||
    role === "BGH" ||
    role === "BAN_GIAM_HIEU" ||
    role === "HIEU_TRUONG" ||
    role === "PHO_HIEU_TRUONG";
  if (isExecutive) return false;

  const dept = (user.department || "").trim();
  const code = (user.departmentCode || "").trim().toUpperCase();

  if (!dept || !code) return true;
  if (code === "QCET" || code === "UNASSIGNED") return true;
  if (
    dept === "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn" ||
    dept === "Chưa cập nhật đơn vị" ||
    dept === "Chưa chọn đơn vị"
  ) {
    return true;
  }
  return false;
}

export const UNASSIGNED_DEPT_PROMPT_KEY = "qcet_profile_unassigned_prompted";
export const UNASSIGNED_DEPT_DISMISSED_KEY = "qcet_dept_prompt_dismissed";

export function shouldPromptUnassignedDepartment(
  user?: { role?: string; department?: string | null; departmentCode?: string | null } | null,
  storage?: { getItem: (key: string) => string | null } | null
): boolean {
  if (!user || !isUserUnassignedDepartment(user)) return false;
  if (!storage) return false;
  try {
    const prompted =
      storage.getItem(UNASSIGNED_DEPT_PROMPT_KEY) ||
      storage.getItem(UNASSIGNED_DEPT_DISMISSED_KEY);
    return !prompted;
  } catch {
    return false;
  }
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isOfflineReadOnly: false,
  authState: { status: "anonymous" },
  canMutate: false,
  switchRole: () => {},
  switchUser: () => {},
  login: async () => ({ success: false, error: "Not initialized" }),
  register: async () => ({ success: false, error: "Not initialized" }),
  loginWithGoogle: () => {
    throw new Error("Google login is handled via server OAuth at /api/auth/google");
  },
  updateProfile: async () => ({ success: false, error: "Not initialized" }),
  logout: async () => {},
  isProfileModalOpen: false,
  setIsProfileModalOpen: () => {},
  isLoading: true,
});

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export interface SessionResolutionResult {
  state: AuthState;
  canMutate: boolean;
  user: AuthUser | CachedUser | null;
  isAuthenticated: boolean;
  isOfflineReadOnly: boolean;
}

/**
 * Pure session state resolver enforcing Server Session Truth (31-auth-security.md):
 * - Server session is the sole authority for active authentication.
 * - If server session is valid (200 with authenticated: true):
 *     state: { status: 'authenticated', user }, canMutate: true, isAuthenticated: true, isOfflineReadOnly: false
 * - If server returns 401 / unauthenticated / offline error, but localStorage has cached identity:
 *     state: { status: 'offline-cached', user }, canMutate: false, isAuthenticated: false, isOfflineReadOnly: true
 * - If server returns 401 / unauthenticated and no cached identity exists:
 *     state: { status: 'anonymous' }, canMutate: false, user: null, isAuthenticated: false, isOfflineReadOnly: false
 */
export function resolveSessionState(
  serverAuth: { authenticated: boolean; user?: any } | null,
  cachedUserStr: string | object | null
): SessionResolutionResult {
  if (serverAuth && serverAuth.authenticated && serverAuth.user) {
    const serverUser = mapDbUserToAuthUser(serverAuth.user);
    return {
      state: { status: "authenticated", user: serverUser },
      canMutate: true,
      user: serverUser,
      isAuthenticated: true,
      isOfflineReadOnly: false,
    };
  }

  if (cachedUserStr) {
    try {
      const parsed = typeof cachedUserStr === "string" ? JSON.parse(cachedUserStr) : cachedUserStr;
      if (parsed && typeof parsed === "object" && parsed.id) {
        const cachedUser: CachedUser = {
          ...parsed,
          cachedAt: parsed.cachedAt || new Date().toISOString(),
          isOfflineCached: true,
        };
        return {
          state: { status: "offline-cached", user: cachedUser },
          canMutate: false,
          user: cachedUser,
          isAuthenticated: false,
          isOfflineReadOnly: true,
        };
      }
    } catch {
      // not valid JSON
    }
  }

  return {
    state: { status: "anonymous" },
    canMutate: false,
    user: null,
    isAuthenticated: false,
    isOfflineReadOnly: false,
  };
}

/**
 * Guard assertion enforcing Server Session Truth (31-auth-security.md):
 * Mutations are only permitted when the session is authenticated by the server
 * and canMutate is true. Offline-cached or anonymous sessions cannot mutate data.
 */
export function assertCanMutate(canMutate: boolean, authState: AuthState): void {
  if (!canMutate || authState.status !== "authenticated") {
    const errorMsg =
      "Mutations not permitted: session is offline-cached or unauthenticated (Server Session Truth)";
    throw new Error(errorMsg);
  }
}

export async function performSessionSync(
  fetchFn: typeof fetch = fetch,
  storage: { getItem: (key: string) => string | null; setItem?: (key: string, value: string) => void } | null = typeof window !== "undefined" ? localStorage : null
): Promise<SessionResolutionResult> {
  let serverAuth: { authenticated: boolean; user?: any } | null = null;
  try {
    const res = await fetchFn("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        serverAuth = data;
      }
    } else {
      serverAuth = { authenticated: false };
    }
  } catch (err) {
    console.warn("Session check /api/auth/me encountered error, using local fallback:", err);
    serverAuth = null;
  }

  let cachedUserStr: string | null = null;
  if (storage) {
    try {
      cachedUserStr = storage.getItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const resolution = resolveSessionState(serverAuth, cachedUserStr);

  if (resolution.isAuthenticated && resolution.user && storage?.setItem) {
    try {
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(resolution.user));
    } catch {
      // ignore
    }
  }

  return resolution;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [user, setUser] = useState<AuthUser | CachedUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isOfflineReadOnly, setIsOfflineReadOnly] = useState<boolean>(false);
  const [canMutate, setCanMutate] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to load registered users from localStorage
  const getRegisteredUsers = (): AuthUser[] => {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(REGISTERED_USERS_KEY);
      if (data) {
        return JSON.parse(data) as AuthUser[];
      }
    } catch {
      // ignore
    }
    return [];
  };

  // Helper to save registered users
  const saveRegisteredUsers = (users: AuthUser[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  };

  // Sync session with server /api/auth/me on mount
  useEffect(() => {
    let isMounted = true;

    async function syncSession() {
      const storage = typeof window !== "undefined" ? localStorage : null;
      const resolution = await performSessionSync(fetch, storage);

      if (!isMounted) return;

      setAuthState(resolution.state);
      setUser(resolution.user);
      setIsAuthenticated(resolution.isAuthenticated);
      setIsOfflineReadOnly(resolution.isOfflineReadOnly);
      setCanMutate(resolution.canMutate);
      setIsLoading(false);
    }

    syncSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          const errorMsg =
            data.error?.message ||
            (typeof data.error === "string" ? data.error : data.message) ||
            "Email hoặc mật khẩu không chính xác";
          return {
            success: false,
            error: errorMsg,
          };
        }

        const authenticatedUser = mapDbUserToAuthUser(data.user);
        setAuthState({ status: "authenticated", user: authenticatedUser });
        setUser(authenticatedUser);
        setIsAuthenticated(true);
        setIsOfflineReadOnly(false);
        setCanMutate(true);

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
          } catch {
            // ignore
          }
        }

        return { success: true, user: authenticatedUser };
      } catch (error) {
        console.error("Login request failed:", error);
        return {
          success: false,
          error: "Không thể kết nối đến máy chủ xác thực",
        };
      }
    },
    []
  );

  const register = useCallback(
    async (data: RegisterPayload): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
          const errorMsg =
            result.error?.message ||
            (typeof result.error === "string" ? result.error : result.message) ||
            "Không thể tạo tài khoản mới";
          return {
            success: false,
            error: errorMsg,
          };
        }

        const createdUser = mapDbUserToAuthUser(result.user);
        setAuthState({ status: "authenticated", user: createdUser });
        setUser(createdUser);
        setIsAuthenticated(true);
        setIsOfflineReadOnly(false);
        setCanMutate(true);
        return { success: true, user: createdUser };
      } catch (error) {
        console.error("Register request failed:", error);
        return {
          success: false,
          error: "Không thể kết nối đến máy chủ xác thực",
        };
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    let userIdToPurge = user?.id;
    if (!userIdToPurge && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          userIdToPurge = parsed?.id;
        }
      } catch {
        // ignore
      }
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout request error:", err);
    }

    if (userIdToPurge) {
      try {
        await purgeUserOfflineData(userIdToPurge);
      } catch (err) {
        console.warn("Error purging user offline data during logout:", err);
      }
    }

    setAuthState({ status: "anonymous" });
    setUser(null);
    setIsAuthenticated(false);
    setIsOfflineReadOnly(false);
    setCanMutate(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
      window.location.href = "/login";
    }
  }, [user?.id]);

  const switchRole = useCallback((role: UserRole) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated: AuthUser = {
        ...(prev as AuthUser),
        role,
        roleLabel:
          role === "ADMIN"
            ? "Ban Giám hiệu"
            : role === "MANAGER"
            ? "Trưởng đơn vị"
            : "Chuyên viên",
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      return updated;
    });
    setAuthState((prev) => {
      if (prev.status === "authenticated") {
        return {
          status: "authenticated",
          user: {
            ...prev.user,
            role,
            roleLabel:
              role === "ADMIN"
                ? "Ban Giám hiệu"
                : role === "MANAGER"
                ? "Trưởng đơn vị"
                : "Chuyên viên",
          },
        };
      }
      if (prev.status === "offline-cached") {
        return {
          status: "offline-cached",
          user: {
            ...prev.user,
            role,
            roleLabel:
              role === "ADMIN"
                ? "Ban Giám hiệu"
                : role === "MANAGER"
                ? "Trưởng đơn vị"
                : "Chuyên viên",
          },
        };
      }
      return prev;
    });
  }, []);

  const switchUser = useCallback(
    (userId: string) => {
      const registered = getRegisteredUsers();
      const targetUser = registered.find((u) => u.id === userId || u.email === userId);
      if (targetUser) {
        const isServerSession =
          authState.status === "authenticated" &&
          (authState.user.id === targetUser.id || authState.user.email === targetUser.email);

        if (isServerSession) {
          setAuthState({ status: "authenticated", user: targetUser });
          setUser(targetUser);
          setIsAuthenticated(true);
          setIsOfflineReadOnly(false);
          setCanMutate(true);
        } else {
          // Switching user locally must NEVER unilaterally elevate state to authenticated or canMutate: true
          const cachedUser: CachedUser = {
            ...targetUser,
            cachedAt: new Date().toISOString(),
            isOfflineCached: true,
          };
          setAuthState({ status: "offline-cached", user: cachedUser });
          setUser(cachedUser);
          setIsAuthenticated(false);
          setIsOfflineReadOnly(true);
          setCanMutate(false);
        }

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetUser));
          } catch {
            // ignore
          }
        }
      }
    },
    [authState]
  );

  /**
   * @deprecated Client-side Google session synthesis is deprecated and prohibited by Server Session Truth.
   * Google login is handled via server OAuth flow at /api/auth/google.
   */
  const loginWithGoogle = useCallback(
    (_payload?: { email?: string; name?: string; avatar?: string }): AuthUser => {
      if (typeof window !== "undefined") {
        window.location.href = "/api/auth/google";
      }
      throw new Error(
        "Google login is handled via server OAuth at /api/auth/google"
      );
    },
    []
  );

  const updateProfile = useCallback(
    async (updates: Partial<AuthUser>): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
      assertCanMutate(canMutate, authState);

      const payload: { name?: string; phone?: string | null; title?: string | null } = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.phone !== undefined) payload.phone = updates.phone.trim() || null;
      if (updates.title !== undefined) payload.title = updates.title.trim() || null;

      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const errorMsg = data.error || "Không thể cập nhật thông tin hồ sơ trên máy chủ";
          return { success: false, error: errorMsg };
        }

        const serverUser = data.user;
        const mappedUser = mapDbUserToAuthUser(serverUser);

        setUser((prev) => {
          if (!prev) return mappedUser;
          const updated: AuthUser = {
            ...(prev as AuthUser),
            ...mappedUser,
            isFirstLogin: false,
          };

          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));

              const registered = getRegisteredUsers();
              const index = registered.findIndex((u) => u.id === updated.id || u.email === updated.email);
              if (index >= 0) {
                registered[index] = updated;
                saveRegisteredUsers(registered);
              } else {
                saveRegisteredUsers([...registered, updated]);
              }
            } catch {
              // ignore
            }
          }

          return updated;
        });

        setAuthState((prev) => {
          if (prev.status === "authenticated") {
            return {
              status: "authenticated",
              user: {
                ...prev.user,
                ...mappedUser,
                isFirstLogin: false,
              },
            };
          }
          return prev;
        });

        return { success: true, user: mappedUser };
      } catch (err: any) {
        return { success: false, error: err?.message || "Lỗi kết nối khi cập nhật hồ sơ" };
      }
    },
    [canMutate, authState]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isOfflineReadOnly,
        authState,
        canMutate,
        switchRole,
        switchUser,
        login,
        register,
        loginWithGoogle,
        updateProfile,
        logout,
        isProfileModalOpen,
        setIsProfileModalOpen,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
