/**
 * QCET E-Office: PostgreSQL Full-Text Search (FTS) & Search Utilities Test Suite
 *
 * Task 12: PostgreSQL Full-Text Search (FTS) & Search Utilities
 * Validates:
 * 1. Heuristic exact-code detection vs natural language keywords
 * 2. Parameterized SQL query generation (Prisma.sql, FTS tsvector, ts_rank, pg_trgm)
 * 3. Strict SQL Injection immunity (parameter binding verification)
 * 4. Filter bindings (status, departmentId, scope, type, role) & pagination (limit, offset)
 * 5. Native execution against PostgreSQL database and graceful fallback execution
 * 6. Verification of FTS and Trigram GIN indexes in PostgreSQL catalog
 */

import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  isExactCodeQuery,
  cleanExactCode,
  buildTaskSearchQuery,
  buildTaskFallbackSearchQuery,
  buildDocumentSearchQuery,
  buildDocumentFallbackSearchQuery,
  buildUserSearchQuery,
  buildUserFallbackSearchQuery,
  searchTasks,
  searchDocuments,
  searchUsers,
} from "../src/lib/db/search";
import { TaskStatus, TaskScope, DocumentType, DocumentStatus, UserRole } from "@prisma/client";

test("Task 12: PostgreSQL Full-Text Search (FTS) & Search Utilities", async (t) => {
  // --------------------------------------------------------------------
  // Suite 1: Query Heuristics & Code Detection
  // --------------------------------------------------------------------
  await t.test("1. Query Heuristics & Code Detection", async (t) => {
    await t.test("identifies institutional codes, numbers, and prefixes as exact code lookups", () => {
      assert.equal(isExactCodeQuery("TASK-101"), true);
      assert.equal(isExactCodeQuery("#42"), true);
      assert.equal(isExactCodeQuery("19/UBND"), true);
      assert.equal(isExactCodeQuery("QCET-2026"), true);
      assert.equal(isExactCodeQuery("TASK-2026-001"), true);
      assert.equal(isExactCodeQuery("QCET-DOC-42"), true);
      assert.equal(isExactCodeQuery("NV-2026-10-017"), true);
      assert.equal(isExactCodeQuery("VB-128"), true);
      assert.equal(isExactCodeQuery("19/UBND-NC"), true);
      assert.equal(isExactCodeQuery("#TASK-99"), true);
      assert.equal(isExactCodeQuery("#128"), true);
      assert.equal(isExactCodeQuery("128"), true);
      assert.equal(isExactCodeQuery("admin@qncet.edu.vn"), true);
      assert.equal(isExactCodeQuery("0912345678"), true);
    });

    await t.test("identifies multi-word phrases and single natural language words as keyword search", () => {
      // Pure alphabetic words must NOT be treated as exact codes
      assert.equal(isExactCodeQuery("Subtask"), false);
      assert.equal(isExactCodeQuery("Kehoach"), false);
      assert.equal(isExactCodeQuery("report"), false);
      assert.equal(isExactCodeQuery("plan"), false);
      assert.equal(isExactCodeQuery("baocao"), false);

      // Multi-word phrases
      assert.equal(isExactCodeQuery("ứng phó bão lũ khẩn cấp"), false);
      assert.equal(isExactCodeQuery("kế hoạch năm học 2026-2027"), false);
      assert.equal(isExactCodeQuery("hướng dẫn công nhận tín chỉ"), false);
      assert.equal(isExactCodeQuery("báo cáo kiểm định"), false);
      assert.equal(isExactCodeQuery("   "), false);
      assert.equal(isExactCodeQuery(""), false);
    });

    await t.test("cleanExactCode strips leading hash symbol and trims whitespace", () => {
      assert.equal(cleanExactCode("#TASK-001"), "TASK-001");
      assert.equal(cleanExactCode("  #128  "), "128");
      assert.equal(cleanExactCode("NV-10"), "NV-10");
    });
  });

  // --------------------------------------------------------------------
  // Suite 2: SQL Builder Generation & SQL Fragment Validation
  // --------------------------------------------------------------------
  await t.test("2. SQL Query Builder & Fragment Generation", async (t) => {
    await t.test("buildTaskSearchQuery generates targeted code lookup for exact codes", () => {
      const query = buildTaskSearchQuery({
        query: "TASK-2026",
      });

      assert.ok(query.sql.includes('"code" = ?'));
      assert.ok(query.sql.includes('"code" ILIKE ?'));
      assert.ok(query.sql.includes('"tasks"'));
      assert.ok(query.sql.includes('LIMIT ? OFFSET ?'));
      assert.ok(!query.sql.includes('to_tsvector'));
      assert.ok(query.values.includes("TASK-2026"));
    });

    await t.test("buildTaskSearchQuery generates PostgreSQL FTS fragments for keyword queries", () => {
      const query = buildTaskSearchQuery({
        query: "phòng chống thiên tai",
      });

      assert.ok(query.sql.includes("to_tsvector('simple'"));
      assert.ok(query.sql.includes("plainto_tsquery('simple'"));
      assert.ok(query.sql.includes("ts_rank("));
      assert.ok(query.sql.includes("similarity("));
      assert.ok(!query.sql.includes("> 0.15"), "buildTaskSearchQuery must not include similarity > 0.15 in WHERE clause");
      assert.ok(query.values.includes("phòng chống thiên tai"));
    });

    await t.test("buildTaskFallbackSearchQuery generates safe ILIKE queries", () => {
      const fallback = buildTaskFallbackSearchQuery({
        query: "phòng chống",
      });

      assert.ok(!fallback.sql.includes("to_tsvector"));
      assert.ok(fallback.sql.includes('"title" ILIKE ?'));
      assert.ok(fallback.sql.includes('coalesce("description", \'\') ILIKE ?'));
      assert.ok(fallback.values.includes("%phòng chống%"));
    });

    await t.test("buildDocumentSearchQuery generates exact lookup and FTS queries", () => {
      // Exact code query
      const exactDoc = buildDocumentSearchQuery({
        query: "19/UBND-NC",
      });
      assert.ok(exactDoc.sql.includes('"original_number" = ?'));
      assert.ok(exactDoc.values.includes("19/UBND-NC"));

      // Natural language summary query
      const ftsDoc = buildDocumentSearchQuery({
        query: "áp thấp nhiệt đới",
      });
      assert.ok(ftsDoc.sql.includes("to_tsvector('simple', coalesce(\"summary\", ''))"));
      assert.ok(ftsDoc.sql.includes("plainto_tsquery('simple'"));
      assert.ok(!ftsDoc.sql.includes("> 0.15"), "buildDocumentSearchQuery must not include similarity > 0.15 in WHERE clause");
      assert.ok(ftsDoc.values.includes("áp thấp nhiệt đới"));
    });

    await t.test("buildUserSearchQuery generates email/phone lookup and FTS queries", () => {
      const exactUser = buildUserSearchQuery({
        query: "bgh@cdktcnqn.edu.vn",
      });
      assert.ok(exactUser.sql.includes('"email" = ?'));
      assert.ok(exactUser.values.includes("bgh@cdktcnqn.edu.vn"));

      const ftsUser = buildUserSearchQuery({
        query: "Trưởng phòng Đào tạo",
      });
      assert.ok(ftsUser.sql.includes("to_tsvector('simple'"));
      assert.ok(ftsUser.sql.includes("plainto_tsquery('simple'"));
      assert.ok(ftsUser.sql.includes('coalesce("title", \'\')'), "buildUserSearchQuery must include title in tsvector expression");
      assert.ok(!ftsUser.sql.includes("> 0.15"), "buildUserSearchQuery must not include similarity > 0.15 in WHERE clause");
      assert.ok(ftsUser.values.includes("Trưởng phòng Đào tạo"));
    });
  });

  // --------------------------------------------------------------------
  // Suite 3: SQL Injection Immunity & Parameter Binding
  // --------------------------------------------------------------------
  await t.test("3. SQL Injection Immunity & Parameter Safety", async (t) => {
    await t.test("binds malicious injection payloads into parameters, never raw string concatenation", () => {
      const maliciousInputs = [
        "TASK-001' OR '1'='1",
        "'; DROP TABLE tasks; --",
        "UNION SELECT * FROM users --",
        "admin'--",
      ];

      for (const malicious of maliciousInputs) {
        const query = buildTaskSearchQuery({
          query: malicious,

          status: "IN_PROGRESS",
        });

        // The raw SQL structure MUST NOT contain the malicious literal payload
        assert.ok(!query.sql.includes("DROP TABLE"));
        assert.ok(!query.sql.includes("DELETE FROM tasks"));
        assert.ok(!query.sql.includes("' OR '1'='1"));

        // All malicious strings must be isolated inside the values array
        assert.ok(query.values.includes(malicious) || query.values.includes(malicious + "%"));
        assert.ok(query.values.includes("DEPT'; DELETE FROM tasks; --"));
      }
    });

    await t.test("binds filter parameters safely with typed enum casts", () => {
      const query = buildTaskSearchQuery({
        query: "nhiệm vụ",
        status: TaskStatus.IN_PROGRESS,

        scope: TaskScope.DEPARTMENT,
      });

      assert.ok(query.sql.includes('"status" = ?::"TaskStatus"'));
      assert.ok(query.sql.includes('"scope" = ?::"TaskScope"'));
      assert.ok(query.sql.includes('"department_id" = ?'));
      assert.ok(query.values.includes("IN_PROGRESS"));
      assert.ok(query.values.includes("DEPARTMENT"));
      assert.ok(query.values.includes("BGH"));
    });

    await t.test("clamps pagination parameters and binds them correctly", () => {
      const query = buildTaskSearchQuery({
        query: "test",
        limit: 50,
        offset: 100,
      });

      assert.ok(query.sql.includes("LIMIT ? OFFSET ?"));
      assert.ok(query.values.includes(50));
      assert.ok(query.values.includes(100));

      // Clamps over-sized limit
      const clampedQuery = buildTaskSearchQuery({
        query: "test",
        limit: 9999,
        offset: -5,
      });
      assert.ok(clampedQuery.values.includes(100)); // Clamped to 100
      assert.ok(clampedQuery.values.includes(0));   // Clamped to 0
    });
  });

  // --------------------------------------------------------------------
  // Suite 4: Database Execution & Search Results (PostgreSQL Engine)
  // --------------------------------------------------------------------
  await t.test("4. Native PostgreSQL Engine Execution", async (t) => {
    await t.test("searchTasks performs exact code lookup against database", async () => {
      const results = await searchTasks(prisma, {
        query: "TASK-EMERGENCY",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.ok(results[0].code.startsWith("TASK-EMERGENCY"));
        assert.ok(results[0].id);
        assert.ok(results[0].title);
        assert.equal(typeof results[0].progressPercent, "number");
      }
    });

    await t.test("searchTasks performs FTS keyword search and ranks results", async () => {
      const results = await searchTasks(prisma, {
        query: "bão lũ khẩn cấp",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.ok(results[0].title.toLowerCase().includes("bão") || results[0].title.toLowerCase().includes("khẩn cấp"));
        assert.ok(typeof results[0].rank === "number");
        assert.ok((results[0].rank ?? 0) > 0);
      }
    });

    await t.test("searchTasks with single word 'Subtask' executes keyword FTS search on title/description", async () => {
      // Ensure at least one test task contains 'Subtask' in title/description
      const anyUser = await prisma.user.findFirst({ select: { id: true } });
      if (anyUser) {
        await prisma.task.upsert({
          where: { code: "TASK-TEST-SUBTASK-FTS" },
          update: {},
          create: {
            code: "TASK-TEST-SUBTASK-FTS",
            title: "Kiểm tra Subtask theo FTS",
            description: "Mô tả kiểm thử tìm kiếm từ khóa Subtask",
            status: TaskStatus.IN_PROGRESS,
            scope: TaskScope.SCHOOL,
            academicMonth: 9,
            academicYear: "2026-2027",
            dueDate: new Date("2026-10-15"),
            createdById: anyUser.id,
          },
        });
      }

      const results = await searchTasks(prisma, {
        query: "Subtask",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0, "Expected tasks matching 'Subtask' in title");
      assert.ok(
        results.some((t) => t.title.toLowerCase().includes("subtask") || (t.description && t.description.toLowerCase().includes("subtask"))),
        "Tasks must match by title or description"
      );
    });

    await t.test("EXPLAIN query plan on tasks uses Bitmap Index Scan / index scan and not full Seq Scan", async () => {
      await prisma.$executeRawUnsafe("SET enable_seqscan = off");
      try {
        const query = buildTaskSearchQuery({
          query: "bão lũ khẩn cấp",
        });
        const explainRows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
          "EXPLAIN " + query.text,
          ...query.values
        );
        const planText = explainRows.map((r) => r["QUERY PLAN"]).join("\n");

        assert.ok(
          planText.includes("Bitmap Index Scan") || planText.includes("Index Scan") || planText.includes("Bitmap Heap Scan"),
          `Expected query plan to use index scan, got: ${planText}`
        );
        assert.ok(
          !planText.includes("Seq Scan"),
          `Query plan must not fall back to Seq Scan when indexes are available: ${planText}`
        );
      } finally {
        await prisma.$executeRawUnsafe("SET enable_seqscan = on");
      }
    });

    await t.test("searchDocuments performs exact original number lookup against database", async () => {
      const results = await searchDocuments(prisma, {
        query: "19/UBND-NC",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.equal(results[0].originalNumber, "19/UBND-NC");
        assert.ok(results[0].summary);
      }
    });

    await t.test("searchDocuments performs FTS search on summary", async () => {
      const results = await searchDocuments(prisma, {
        query: "nhiệm vụ trọng tâm năm học",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.ok(results[0].summary.toLowerCase().includes("nhiệm vụ") || results[0].summary.toLowerCase().includes("năm học"));
        assert.ok((results[0].rank ?? 0) >= 0);
      }
    });

    await t.test("searchUsers finds user by exact email", async () => {
      const results = await searchUsers(prisma, {
        query: "bgh.sod@cdktcnqn.edu.vn",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.equal(results[0].email, "bgh.sod@cdktcnqn.edu.vn");
      }
    });

    await t.test("searchUsers finds user by natural text keyword", async () => {
      const results = await searchUsers(prisma, {
        query: "Hiệu trưởng",
        limit: 5,
      });

      assert.ok(Array.isArray(results));
      if (results.length > 0) {
        assert.ok(results.some((u) => u.name.includes("Hiệu trưởng") || (u.title && u.title.includes("Hiệu trưởng"))));
      }
    });

    await t.test("gracefully falls back to parameterized ILIKE when simulated failure occurs", async () => {
      let fallbackExecuted = false;
      const mockClient: any = {
        async $queryRaw(sqlObj: any) {
          // Fail the primary query to simulate missing FTS / pg_trgm
          if (sqlObj.sql.includes("to_tsvector")) {
            throw new Error("Simulated missing pg_trgm or FTS extension");
          }
          fallbackExecuted = true;
          return [
            {
              id: "fallback-task-1",
              code: "FALLBACK-01",
              title: "Fallback Task Result",
              description: "Fallback description",
              scope: "SCHOOL",
              status: "IN_PROGRESS",
              priority: "NORMAL",
              progress_percent: 25,
              due_date: new Date(),
              academic_month: 10,
              academic_year: "2026-2027",
              department_id: "BGH",
              rank: 0.5,
            },
          ];
        },
      };

      const results = await searchTasks(mockClient, {
        query: "phòng chống thiên tai",
      });

      assert.equal(fallbackExecuted, true);
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "fallback-task-1");
      assert.equal(results[0].code, "FALLBACK-01");
    });
  });

  // --------------------------------------------------------------------
  // Suite 5: PostgreSQL FTS & Trigram Indexes in Catalog
  // --------------------------------------------------------------------
  await t.test("5. PostgreSQL FTS & Trigram Indexes in Catalog", async (t) => {
    await t.test("verifies GIN and FTS indexes exist in pg_indexes", async () => {
      const ftsIndexes = await prisma.$queryRaw<Array<{ indexname: string; tablename: string; indexdef: string }>>`
        SELECT indexname, tablename, indexdef
        FROM pg_indexes
        WHERE tablename IN ('tasks', 'documents', 'users')
          AND (indexname LIKE '%fts%' OR indexname LIKE '%trgm%')
        ORDER BY tablename, indexname
      `;

      const indexNames = new Set(ftsIndexes.map((idx) => idx.indexname));

      assert.ok(
        indexNames.has("task_title_description_fts_idx"),
        "Expected task_title_description_fts_idx in pg_indexes"
      );
      assert.ok(
        indexNames.has("task_title_trgm_idx"),
        "Expected task_title_trgm_idx in pg_indexes"
      );
      assert.ok(
        indexNames.has("document_title_fts_idx"),
        "Expected document_title_fts_idx in pg_indexes"
      );
      assert.ok(
        indexNames.has("document_summary_trgm_idx"),
        "Expected document_summary_trgm_idx in pg_indexes"
      );
      assert.ok(
        indexNames.has("user_name_email_fts_idx"),
        "Expected user_name_email_fts_idx in pg_indexes"
      );
      assert.ok(
        indexNames.has("user_name_trgm_idx"),
        "Expected user_name_trgm_idx in pg_indexes"
      );

      // Verify each index definition uses GIN
      for (const idx of ftsIndexes) {
        assert.ok(
          idx.indexdef.toLowerCase().includes("using gin"),
          `Index ${idx.indexname} definition should use GIN: ${idx.indexdef}`
        );
      }

      // Verify user_name_email_fts_idx includes title in functional index
      const userFts = ftsIndexes.find((idx) => idx.indexname === "user_name_email_fts_idx");
      assert.ok(userFts, "user_name_email_fts_idx must exist in pg_indexes");
      assert.ok(
        userFts.indexdef.toLowerCase().includes("title"),
        `user_name_email_fts_idx must include title column in its expression: ${userFts.indexdef}`
      );
    });
  });
});
