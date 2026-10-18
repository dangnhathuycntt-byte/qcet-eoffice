import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeLogContext, sanitizeString } from "@qcet/shared/telemetry/sanitize";
import { ServerLogger } from "../../apps/api/src/telemetry/server";
import { getMetricRating } from "../../apps/web/src/telemetry/web-vitals";

describe("Error Boundary & Structured Logging Integration", () => {
  it("enforces sanitization of sensitive credentials and headers in log context", () => {
    const raw = {
      user: "officer-1",
      password: "PlainTextPassword123",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      cookie: "session_id=12345",
      database_url: "postgres://user:pass@localhost:5432/db",
    };

    const sanitized = sanitizeLogContext(raw) as Record<string, unknown>;

    assert.equal(sanitized.user, "officer-1");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.authorization, "[REDACTED]");
    assert.equal(sanitized.cookie, "[REDACTED]");
    assert.equal(sanitized.database_url, "[REDACTED]");
  });

  it("server logger writes sanitized JSON with timestamp and level", () => {
    let captured: any = null;
    const logger = new ServerLogger({
      minLevel: "debug",
      writer: (entry) => {
        captured = entry;
      },
    });

    logger.warn("Database connection retry", {
      dbUrl: "postgresql://user:secret@localhost:5432/qcet",
      attempt: 3,
    });

    assert.ok(captured);
    assert.equal(captured.level, "warn");
    assert.equal(captured.message, "Database connection retry");
    assert.equal(captured.context.dbUrl, "[REDACTED]");
    assert.equal(captured.context.attempt, 3);
  });
});
