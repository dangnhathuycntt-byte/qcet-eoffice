/**
 * Web và api chạy thành hai dịch vụ: log JSON của api mang `service` từ SERVICE_NAME để phân biệt nguồn;
 * không đặt biến thì không có trường này (log như trước khi tách).
 */
import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { StructuredLogger, type StructuredLogEntry } from "@/server/observability/logger";

describe("logger: SERVICE_NAME", () => {
  const saved = process.env.SERVICE_NAME;
  afterEach(() => {
    if (saved === undefined) delete process.env.SERVICE_NAME;
    else process.env.SERVICE_NAME = saved;
  });

  const capture = () => {
    const entries: StructuredLogEntry[] = [];
    const lines: string[] = [];
    const logger = new StructuredLogger();
    logger.setWriter((entry, line) => {
      entries.push(entry);
      lines.push(line);
    });
    return { logger, entries, lines };
  };

  test("đặt SERVICE_NAME thì mỗi dòng log có service", () => {
    process.env.SERVICE_NAME = "qcet-api";
    const { logger, entries, lines } = capture();
    logger.info("task.created", { requestId: "r1" });
    assert.equal(entries[0].service, "qcet-api");
    assert.equal(JSON.parse(lines[0]).service, "qcet-api");
  });

  test("không đặt SERVICE_NAME thì không có trường service", () => {
    delete process.env.SERVICE_NAME;
    const { logger, entries } = capture();
    logger.info("task.created");
    assert.equal("service" in entries[0], false);
  });
});
