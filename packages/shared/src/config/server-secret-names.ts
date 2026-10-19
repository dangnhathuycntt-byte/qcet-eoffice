/**
 * Tên biến bí mật phía server không bao giờ được đưa sang client (env.client của web kiểm theo danh sách này).
 */
export const FORBIDDEN_SERVER_SECRETS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "JWT_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "VAPID_PRIVATE_KEY",
  "POSTGRES_PASSWORD",
  "POSTGRES_USER",
  "NOTION_TOKEN",
] as const;
