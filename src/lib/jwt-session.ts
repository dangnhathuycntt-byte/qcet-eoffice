import jwt from "jsonwebtoken";
import { UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "qcet_session";

export function getJwtSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return process.env.JWT_SECRET || "qcet_fallback_secret_key_2026";
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole | "BAN_GIAM_HIEU" | "TRUONG_PHONG" | "CHUYEN_VIEN" | string;
  departmentId?: string | null;
  title?: string | null;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}
