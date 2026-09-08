"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { AuthUser, UserRole, OnboardingData } from "../types/auth";
import { DEFAULT_DEMO_USERS } from "./role-task-filter";

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
  user: AuthUser | null;
  switchRole: (role: UserRole) => void;
  switchUser: (userId: string) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  register: (data: RegisterPayload) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  loginWithGoogle: (payload: {
    email: string;
    name: string;
    avatar?: string;
  }) => AuthUser;
  updateProfile: (updates: Partial<AuthUser>) => void;
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  switchRole: () => {},
  switchUser: () => {},
  login: async () => ({ success: false, error: "Not initialized" }),
  register: async () => ({ success: false, error: "Not initialized" }),
  loginWithGoogle: () => ({
    id: "uninitialized",
    name: "",
    email: "",
    role: "STAFF",
    roleLabel: "",
    department: "",
    departmentCode: "",
  }),
  updateProfile: () => {},
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
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
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            const serverUser = mapDbUserToAuthUser(data.user);
            setUser(serverUser);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(serverUser));
              } catch {
                // ignore
              }
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Session check /api/auth/me encountered error, using local fallback:", err);
      }

      // Fallback to localStorage if not authenticated on server or offline
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(AUTH_STORAGE_KEY);
          if (saved && isMounted) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && typeof parsed === "object" && parsed.id) {
                setUser(parsed as AuthUser);
                setIsLoading(false);
                return;
              }
            } catch {
              // not JSON
            }
            const found = DEFAULT_DEMO_USERS.find(
              (u) => u.role === saved || u.id === saved
            );
            if (found) {
              setUser(found);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // localStorage unavailable
        }
      }

      // Unauthenticated visitor: user remains null without auto-establishing demo session
      if (isMounted) {
        setUser(null);
        setIsLoading(false);
      }
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
          return {
            success: false,
            error: data.error || "Email hoặc mật khẩu không chính xác",
          };
        }

        const authenticatedUser = mapDbUserToAuthUser(data.user);
        setUser(authenticatedUser);

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
          return {
            success: false,
            error: result.error || "Không thể tạo tài khoản mới",
          };
        }

        const createdUser = mapDbUserToAuthUser(result.user);
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
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout request error:", err);
    }

    setUser(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
      window.location.href = "/login";
    }
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    const targetUser =
      DEFAULT_DEMO_USERS.find((u) => u.role === role) || DEFAULT_DEMO_USERS[0];
    setUser(targetUser);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetUser));
      } catch {
        // ignore
      }
      fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetUser.role, userId: targetUser.id }),
      }).catch((e) => console.warn("switchRole demo-session sync failed:", e));
    }
  }, []);

  const switchUser = useCallback((userId: string) => {
    const targetUser =
      DEFAULT_DEMO_USERS.find((u) => u.id === userId || u.role === userId) || DEFAULT_DEMO_USERS[0];
    setUser(targetUser);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetUser));
      } catch {
        // ignore
      }
      fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id, role: targetUser.role }),
      }).catch((e) => console.warn("switchUser demo-session sync failed:", e));
    }
  }, []);

  const loginWithGoogle = useCallback(
    (payload: { email: string; name: string; avatar?: string }): AuthUser => {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const registered = getRegisteredUsers();

      // 1. Check if user already exists in registered list
      const existingUser = registered.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );

      if (existingUser) {
        const updated = {
          ...existingUser,
          avatar: payload.avatar || existingUser.avatar,
        };
        setUser(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        }
        return updated;
      }

      // 2. Check if email matches one of the demo users
      const matchingDemo = DEFAULT_DEMO_USERS.find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (matchingDemo) {
        const demoWithAvatar = {
          ...matchingDemo,
          avatar: payload.avatar || matchingDemo.avatar,
        };
        setUser(demoWithAvatar);
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(demoWithAvatar));
        }
        return demoWithAvatar;
      }

      // 3. Auto-provision new AuthUser
      const emailPrefix = normalizedEmail.split("@")[0];
      const formattedName =
        payload.name ||
        emailPrefix
          .replace(/[._-]+/g, " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const isBgh = normalizedEmail.includes("bgh") || normalizedEmail.includes("hieutruong");
      const isLeader = normalizedEmail.includes("truongphong") || normalizedEmail.includes("daotao");

      const newUser: AuthUser = {
        id: `user-staff-${Date.now()}`,
        name: formattedName,
        email: normalizedEmail,
        role: isBgh ? "ADMIN" : isLeader ? "MANAGER" : "STAFF",
        roleLabel: isBgh
          ? "Ban Giám hiệu"
          : isLeader
          ? "Trưởng đơn vị"
          : "Viên chức / Giảng viên",
        department: "Chưa cập nhật đơn vị",
        departmentCode: "QCET",
        title: "Viên chức",
        avatar: payload.avatar,
        isFirstLogin: true,
        emailVerified: true,
        provider: "google",
      };

      const nextRegistered = [...registered, newUser];
      saveRegisteredUsers(nextRegistered);

      setUser(newUser);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        } catch {
          // ignore
        }
      }

      setIsProfileModalOpen(true);
      return newUser;
    },
    []
  );

  const updateProfile = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated: AuthUser = {
        ...prev,
        ...updates,
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
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
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
