import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ServerEnvSchema,
  validateServerEnv,
  DEV_AUTH_SECRET_FALLBACK,
  DEV_DATABASE_URL_FALLBACK,
} from "@/config/env.server";
import {
  ClientEnvSchema,
  validateClientEnv,
  FORBIDDEN_SERVER_SECRETS,
} from "@/config/env.client";
import {
  getPublicRuntimeConfig,
  assertZeroSecrets,
} from "@/config/runtime";
import { GET as getRuntimeConfig } from "@/app/api/runtime-config/route";

describe("Central Environment Configuration & Secret Isolation (Task 2)", () => {
  describe("ServerEnvSchema & Server Validation", () => {
    it("validates correct production configuration", () => {
      const validProdConfig = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://qcet_admin:super_secret_pw@qcet-db:5432/qcet_eoffice?schema=public",
        AUTH_SECRET: "qcet_production_master_secret_key_2026_at_least_32_chars",
        PORT: "3001",
        GOOGLE_CLIENT_ID: "google-client-id-123",
        GOOGLE_CLIENT_SECRET: "google-client-secret-xyz",
        VAPID_PUBLIC_KEY: "vapid-pub-key",
        VAPID_PRIVATE_KEY: "vapid-priv-key",
        VAPID_SUBJECT: "mailto:admin@cdktcnqn.edu.vn",
      };

      const parsed = ServerEnvSchema.parse(validProdConfig);
      assert.strictEqual(parsed.NODE_ENV, "production");
      assert.strictEqual(parsed.PORT, 3001);
      assert.strictEqual(parsed.DATABASE_URL, validProdConfig.DATABASE_URL);
      assert.strictEqual(parsed.AUTH_SECRET, validProdConfig.AUTH_SECRET);
      assert.strictEqual(parsed.GOOGLE_CLIENT_ID, "google-client-id-123");
      assert.strictEqual(parsed.GOOGLE_CLIENT_SECRET, "google-client-secret-xyz");
    });

    it("accepts JWT_SECRET as alias for AUTH_SECRET", () => {
      const configWithJwtSecret = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost:5432/qcet_eoffice",
        JWT_SECRET: "qcet_production_jwt_master_secret_key_2026_min_32_chars",
      };

      const parsed = ServerEnvSchema.parse(configWithJwtSecret);
      assert.strictEqual(parsed.AUTH_SECRET, configWithJwtSecret.JWT_SECRET);
    });

    it("applies development fallbacks when variables are omitted in dev/test", () => {
      const devConfig = {
        NODE_ENV: "development",
      };

      const parsed = ServerEnvSchema.parse(devConfig);
      assert.strictEqual(parsed.NODE_ENV, "development");
      assert.strictEqual(parsed.DATABASE_URL, DEV_DATABASE_URL_FALLBACK);
      assert.strictEqual(parsed.AUTH_SECRET, DEV_AUTH_SECRET_FALLBACK);
      assert.strictEqual(parsed.PORT, 3001);
    });

    it("coerces PORT from string to number", () => {
      const config = {
        NODE_ENV: "test",
        PORT: "8080",
      };

      const parsed = ServerEnvSchema.parse(config);
      assert.strictEqual(parsed.PORT, 8080);
      assert.strictEqual(typeof parsed.PORT, "number");
    });

    it("throws on missing required variables in production (DATABASE_URL)", () => {
      const missingDbUrl = {
        NODE_ENV: "production",
        AUTH_SECRET: "super_secret_production_key_2026_safe_min_32_chars",
      };

      assert.throws(
        () => ServerEnvSchema.parse(missingDbUrl),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("DATABASE_URL is required in production"));
          return true;
        }
      );
    });

    it("throws on missing required variables in production (AUTH_SECRET)", () => {
      const missingSecret = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost:5432/qcet_eoffice",
      };

      assert.throws(
        () => ServerEnvSchema.parse(missingSecret),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("AUTH_SECRET (or JWT_SECRET) is required in production"));
          return true;
        }
      );
    });

    it("throws on AUTH_SECRET shorter than 32 characters in production", () => {
      const shortSecret = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost:5432/qcet_eoffice",
        AUTH_SECRET: "short_secret_under_32",
      };

      assert.throws(
        () => ServerEnvSchema.parse(shortSecret),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("at least 32 characters"));
          return true;
        }
      );
    });

    it("throws when GOOGLE_CLIENT_ID is provided without GOOGLE_CLIENT_SECRET in production", () => {
      const partialGoogle = {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost:5432/qcet_eoffice",
        AUTH_SECRET: "super_secret_production_key_2026_safe_min_32_chars",
        GOOGLE_CLIENT_ID: "client-id-without-secret",
      };

      assert.throws(
        () => ServerEnvSchema.parse(partialGoogle),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("GOOGLE_CLIENT_SECRET is required"));
          return true;
        }
      );
    });

    it("validateServerEnv fails fast on missing production secrets", () => {
      assert.throws(
        () =>
          validateServerEnv({
            NODE_ENV: "production",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("[QCET-ENV] Server environment startup validation failed"));
          return true;
        }
      );
    });
  });

  describe("ClientEnvSchema & Client Secret Rejection", () => {
    it("validates correct client public variables", () => {
      const validClientConfig = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://e-office.cdktcnqn.edu.vn",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "909261849477.apps.googleusercontent.com",
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BM8_vapid_public_key",
        NEXT_PUBLIC_REFERENCE_DATE: "2026-09-01",
        NEXT_PUBLIC_APP_VERSION: "1.0.0",
      };

      const parsed = ClientEnvSchema.parse(validClientConfig);
      assert.strictEqual(parsed.NODE_ENV, "production");
      assert.strictEqual(parsed.NEXT_PUBLIC_APP_URL, validClientConfig.NEXT_PUBLIC_APP_URL);
      assert.strictEqual(parsed.NEXT_PUBLIC_GOOGLE_CLIENT_ID, validClientConfig.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    });

    it("rejects DATABASE_URL in client environment", () => {
      assert.throws(
        () =>
          ClientEnvSchema.parse({
            DATABASE_URL: "postgresql://localhost:5432/qcet_eoffice",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("DATABASE_URL") || (err as Error).message.includes("unrecognized"));
          return true;
        }
      );
    });

    it("rejects all known server secrets in client schema", () => {
      for (const secretKey of FORBIDDEN_SERVER_SECRETS) {
        assert.throws(
          () =>
            ClientEnvSchema.parse({
              [secretKey]: "super_sensitive_value",
            }),
          (err: unknown) => {
            assert.ok(err instanceof Error);
            return true;
          },
          `Expected ClientEnvSchema to reject server secret key: ${secretKey}`
        );
      }
    });

    it("rejects database connection strings embedded in client values", () => {
      assert.throws(
        () =>
          ClientEnvSchema.parse({
            NEXT_PUBLIC_APP_URL: "postgresql://qcet_admin:pass@localhost:5432/qcet_eoffice",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("database connection string"));
          return true;
        }
      );
    });

    it("rejects private cryptographic keys embedded in client values", () => {
      assert.throws(
        () =>
          ClientEnvSchema.parse({
            NEXT_PUBLIC_VAPID_PUBLIC_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("private cryptographic key"));
          return true;
        }
      );
    });

    it("validateClientEnv rejects raw input containing server secrets", () => {
      assert.throws(
        () =>
          validateClientEnv({
            AUTH_SECRET: "should_never_be_here_32_chars_long_key",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("Client environment validation failed"));
          return true;
        }
      );
    });
  });

  describe("Runtime Configuration & Secret Scanner", () => {
    it("assertZeroSecrets passes on clean config and throws on secret leak", () => {
      const cleanConfig = {
        environment: "development",
        features: { googleAuth: true, webPush: false },
        version: "0.1.0",
        buildId: "abc1234",
      };

      // Clean config must not throw
      assert.doesNotThrow(() => assertZeroSecrets(cleanConfig));

      // Leaked secret key must throw
      assert.throws(
        () =>
          assertZeroSecrets({
            ...cleanConfig,
            jwt_secret: "leak",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("Forbidden secret key pattern matched 'jwt_secret'"));
          return true;
        }
      );

      // Leaked database connection string must throw
      assert.throws(
        () =>
          assertZeroSecrets({
            ...cleanConfig,
            dbUri: "postgres://qcet:secret@db:5432/prod",
          }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok((err as Error).message.includes("Database connection string leaked"));
          return true;
        }
      );
    });

    it("getPublicRuntimeConfig returns valid whitelist config without secrets", () => {
      const config = getPublicRuntimeConfig();

      assert.ok(config);
      assert.ok(["development", "production", "test"].includes(config.environment));
      assert.ok(typeof config.version === "string");
      assert.ok(typeof config.buildId === "string");
      assert.ok(typeof config.features === "object");
      assert.strictEqual(typeof config.features.academicCalendarSync, "boolean");
      assert.strictEqual(typeof config.features.offlineSupport, "boolean");
      assert.strictEqual(typeof config.features.googleAuth, "boolean");
      assert.strictEqual(typeof config.features.webPush, "boolean");

      // Verify zero secrets leaked
      assert.doesNotThrow(() => assertZeroSecrets(config as unknown as Record<string, unknown>));
    });
  });

  describe("GET /api/runtime-config Route", () => {
    it("returns 200 with public runtime configuration whitelist and zero secrets", async () => {
      const response = await getRuntimeConfig();
      assert.strictEqual(response.status, 200);

      const data = await response.json();
      assert.ok(data);

      // Required fields from spec: { environment, features, version, buildId }
      assert.ok("environment" in data);
      assert.ok("features" in data);
      assert.ok("version" in data);
      assert.ok("buildId" in data);

      // Verify zero secrets are exposed
      const jsonString = JSON.stringify(data);
      assert.ok(!jsonString.includes("postgres://"), "Response must not contain postgresql connection string");
      assert.ok(!jsonString.includes("qcet_admin"), "Response must not contain postgres user");
      assert.ok(!jsonString.includes("secret"), "Response must not contain secret key names or values");
      assert.ok(!jsonString.includes("PRIVATE KEY"), "Response must not contain private keys");

      // Verify zero forbidden keys exist in response object
      for (const secretKey of FORBIDDEN_SERVER_SECRETS) {
        assert.strictEqual(
          data[secretKey],
          undefined,
          `API response must not contain ${secretKey}`
        );
      }

      // Assert runtime scanner passes on response
      assert.doesNotThrow(() => assertZeroSecrets(data));
    });
  });
});
