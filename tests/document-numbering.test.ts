import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatDocumentDisplayNumber,
  generateDocumentCode,
  simulateAtomicNumbering,
  getNextRegistrationNumber
} from "../src/lib/documents/numbering-engine";
import {
  createDocument,
  listDocuments,
  getDocumentById
} from "../src/lib/documents/document-service";
import type { DocumentItem, DocumentType } from "../src/types/document";

describe("Document Numbering Engine (ND 30/2020)", () => {
  test("formats incoming and outgoing document numbers properly", () => {
    // Sổ đến: Số nguyên tăng dần
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 1, 2026), "01");
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DEN", 125, 2026), "125");

    // Sổ đi: Số / Ký hiệu viết tắt cơ quan
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DI", 89, 2026, "CĐKTCN-ĐT"), "89/CĐKTCN-ĐT");
    assert.equal(formatDocumentDisplayNumber("VAN_BAN_DI", 12, 2026), "12/CĐKTCN");

    // Tờ trình nội bộ
    assert.equal(formatDocumentDisplayNumber("TO_TRINH_NOI_BO", 5, 2026), "TT-5/2026");
  });

  test("generates standardized document codes", () => {
    assert.equal(generateDocumentCode("VAN_BAN_DEN", 2026, 1), "VBDEN-2026-0001");
    assert.equal(generateDocumentCode("VAN_BAN_DI", 2026, 89), "VBDI-2026-0089");
    assert.equal(generateDocumentCode("TO_TRINH_NOI_BO", 2026, 5), "TTNB-2026-0005");
  });

  test("generates unique sequence numbers across concurrent requests", async () => {
    const memorySequence = new Map<string, number>();

    // Giả lập 20 yêu cầu đồng thời cùng cấp số đến năm 2026
    const requests = Array.from({ length: 20 }, () =>
      simulateAtomicNumbering("VAN_BAN_DEN", 2026, memorySequence)
    );

    const results = await Promise.all(requests);
    const uniqueNumbers = new Set(results);

    assert.equal(uniqueNumbers.size, 20, "Every concurrent request must get a unique number");
    assert.equal(Math.min(...results), 1, "Should start from 1");
    assert.equal(Math.max(...results), 20, "Should end at 20");
  });

  test("getNextRegistrationNumber works with custom prisma-like client", async () => {
    const sequences = new Map<string, number>();
    const mockPrismaClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          documentNumberSequence: {
            upsert: async ({ where, create, update }: any) => {
              const key = `${where.type_year.type}_${where.type_year.year}`;
              const current = sequences.get(key);
              if (current === undefined) {
                const initVal = create.lastNumber;
                sequences.set(key, initVal);
                return { lastNumber: initVal };
              } else {
                const nextVal = current + (update.lastNumber.increment || 1);
                sequences.set(key, nextVal);
                return { lastNumber: nextVal };
              }
            }
          }
        };
        return await fn(tx);
      }
    };

    const num1 = await getNextRegistrationNumber("VAN_BAN_DEN", 2026, mockPrismaClient as any);
    const num2 = await getNextRegistrationNumber("VAN_BAN_DEN", 2026, mockPrismaClient as any);
    const numOut1 = await getNextRegistrationNumber("VAN_BAN_DI", 2026, mockPrismaClient as any);

    assert.equal(num1, 1);
    assert.equal(num2, 2);
    assert.equal(numOut1, 1);
  });
});

describe("Document Registration Service", () => {
  test("creates document and retrieves it with relations", async () => {
    const docsStore = new Map<string, any>();
    let idCounter = 1;

    const mockPrismaClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        return await fn(mockPrismaClient);
      },
      documentNumberSequence: {
        upsert: async () => ({ lastNumber: 1 })
      },
      document: {
        create: async ({ data, include }: any) => {
          const docId = `doc-${idCounter++}`;
          const newDoc = {
            id: docId,
            ...data,
            registeredDate: data.registeredDate || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            attachments: data.attachments?.create || [],
            directives: [],
            draftingDept: data.draftingDeptId ? { id: data.draftingDeptId, name: "Phòng Đào tạo" } : null,
            leadDepartment: data.leadDepartmentId ? { id: data.leadDepartmentId, name: "Phòng Đào tạo" } : null,
            leadUser: null,
            registeredBy: { id: data.registeredById, name: "Văn thư" }
          };
          docsStore.set(docId, newDoc);
          return newDoc;
        },
        findMany: async ({ where, orderBy, take, skip, include }: any) => {
          let list = Array.from(docsStore.values());
          if (where?.type) {
            list = list.filter(d => d.type === where.type);
          }
          if (where?.documentYear) {
            list = list.filter(d => d.documentYear === where.documentYear);
          }
          if (where?.status) {
            list = list.filter(d => d.status === where.status);
          }
          return list;
        },
        findUnique: async ({ where, include }: any) => {
          return docsStore.get(where.id) || null;
        }
      }
    };

    const payload = {
      type: "VAN_BAN_DEN" as DocumentType,
      documentYear: 2026,
      originalNumber: "125/TCGDNN-VP",
      issuedDate: new Date("2026-09-05T00:00:00Z"),
      issuingAuthority: "Tổng cục Giáo dục Nghề nghiệp",
      category: "Công văn",
      summary: "V/v tổ chức hội thi thiết bị đào tạo tự làm toàn quốc",
      urgency: "HOA_TOC" as const,
      securityLevel: "THUONG" as const,
      status: "CHO_PHAN_CONG" as const,
      registeredById: "user-vt-1",
      leadDepartmentId: "PHONG_DAO_TAO"
    };

    const created = await createDocument(payload, mockPrismaClient as any);
    assert.equal(created.type, "VAN_BAN_DEN");
    assert.equal(created.originalNumber, "125/TCGDNN-VP");
    assert.equal(created.registrationNumber, 1);
    assert.equal(created.leadDepartmentId, "PHONG_DAO_TAO");

    const retrieved = await getDocumentById(created.id, mockPrismaClient as any);
    assert.ok(retrieved);
    assert.equal(retrieved?.id, created.id);

    const list = await listDocuments({ type: "VAN_BAN_DEN", documentYear: 2026 }, mockPrismaClient as any);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);
  });
});
