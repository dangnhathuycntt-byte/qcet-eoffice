"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { AuthUser, UserRole } from "../types/auth";
import { DEFAULT_DEMO_USERS } from "./role-task-filter";

export const AUTH_STORAGE_KEY = "qcet_active_user";
export const REGISTERED_USERS_KEY = "qcet_registered_users";

export interface AuthContextType {
  user: AuthUser;
  switchRole: (role: UserRole) => void;
  loginWithGoogle: (payload: {
    email: string;
    name: string;
    avatar?: string;
  }) => AuthUser;
  updateProfile: (updates: Partial<AuthUser>) => void;
  logout: () => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_DEMO_USERS[0],
  switchRole: () => {},
  loginWithGoogle: () => DEFAULT_DEMO_USERS[0],
  updateProfile: () => {},
  logout: () => {},
  isProfileModalOpen: false,
  setIsProfileModalOpen: () => {},
});

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(DEFAULT_DEMO_USERS[0]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

  // Restore user from localStorage on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && parsed.id) {
            // Check in registered users list first
            const registered = getRegisteredUsers();
            const foundRegistered = registered.find((u) => u.id === parsed.id || u.email === parsed.email);
            if (foundRegistered) {
              setUser(foundRegistered);
              if (foundRegistered.isFirstLogin) {
                setIsProfileModalOpen(true);
              }
              return;
            }

            // Check if demo user
            const foundDemo = DEFAULT_DEMO_USERS.find((u) => u.id === parsed.id);
            if (foundDemo) {
              setUser(foundDemo);
              return;
            }

            // Otherwise restore the parsed custom user
            setUser(parsed as AuthUser);
            if (parsed.isFirstLogin) {
              setIsProfileModalOpen(true);
            }
            return;
          }
        } catch {
          // not JSON, check string
        }

        const found = DEFAULT_DEMO_USERS.find(
          (u) => u.role === saved || u.id === saved
        );
        if (found) {
          setUser(found);
        }
      }
    } catch {
      // localStorage may be unavailable or disabled
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
        // Update avatar if provided
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

      // 3. Auto-provision (JIT Sign-up) a new AuthUser
      const emailPrefix = normalizedEmail.split("@")[0];
      // Format human-friendly name if provided or format from email prefix
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

      // Save to registered list
      const nextRegistered = [...registered, newUser];
      saveRegisteredUsers(nextRegistered);

      // Set as active user
      setUser(newUser);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        } catch {
          // ignore
        }
      }

      // Open profile modal for initial setup
      setIsProfileModalOpen(true);

      return newUser;
    },
    []
  );

  const updateProfile = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      const updated: AuthUser = {
        ...prev,
        ...updates,
        isFirstLogin: false, // Once updated, mark onboarding complete
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));

          // Also update in registered users list if found
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

  const logout = useCallback(() => {
    setUser(DEFAULT_DEMO_USERS[0]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        switchRole,
        loginWithGoogle,
        updateProfile,
        logout,
        isProfileModalOpen,
        setIsProfileModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
