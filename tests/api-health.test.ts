import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/health/route";
import { prisma } from "../src/lib/prisma";

describe("API Healthcheck Route Handler", () => {
  it("should return JSON response with system status and uptime", async () => {
    const response = await GET();
    assert.ok(response instanceof Response);
    assert.ok(response.status === 200 || response.status === 503);

    const data = await response.json();
    assert.ok(["ok", "degraded"].includes(data.status));
    assert.equal(data.system, "QCET E-Office On-Premise");
    assert.ok(typeof data.uptimeSeconds === "number");
    assert.ok(data.database);
    assert.ok(typeof data.database.latencyMs === "number");
  });

  it("should return 503 degraded when database query fails", async () => {
    const originalQueryRaw = prisma.$queryRaw;
    // Suppress console.error during expected failure test
    const originalError = console.error;
    console.error = () => {};

    try {
      // @ts-expect-error Mocking queryRaw rejection
      prisma.$queryRaw = async () => {
        throw new Error("PostgreSQL connection refused");
      };

      const response = await GET();
      assert.equal(response.status, 503);

      const data = await response.json();
      assert.equal(data.status, "degraded");
      assert.equal(data.database.status, "unhealthy");
      assert.equal(data.system, "QCET E-Office On-Premise");
      assert.ok(typeof data.uptimeSeconds === "number");
    } finally {
      prisma.$queryRaw = originalQueryRaw;
      console.error = originalError;
    }
  });
});
