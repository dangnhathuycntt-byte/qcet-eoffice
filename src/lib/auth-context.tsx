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

export interface AuthContextType {
  user: AuthUser;
  switchRole: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_DEMO_USERS[0],
  switchRole: () => {},
  logout: () => {},
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

  // Restore user from localStorage on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            const found = DEFAULT_DEMO_USERS.find(
              (u) => u.id === parsed.id || u.role === parsed.role
            );
            if (found) {
              setUser(found);
              return;
            }
          }
        } catch {
          // not JSON, check if string matches role or id
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
    <AuthContext.Provider value={{ user, switchRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
