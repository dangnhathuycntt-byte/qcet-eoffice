/**
 * Đặc tả route `POST /api/documents/{id}/attachments` (bổ sung tệp đã tải lên cho văn bản).
 *
 * Khóa hành vi hiện tại: CSRF → Content-Type JSON → cỡ body → xác thực → kiểm body (strict, `fileId`)
 * → 404 văn bản → quyền cập nhật (`canUpdateDocument`) → bất biến → dịch vụ gắn tệp (chỉ tệp do chính
 * người dùng tải lên, không bị lưu trữ, không nhiễm mã độc) → nhật ký DOCUMENT_ATTACHMENT_ADDED.
 * Lỗi theo định dạng JSON thường `{ success:false, code, message }` (route không bật RFC 9457).
 * Loại/cỡ tệp do `POST /api/upload` kiểm (đã có ở file-routes.test.ts), route này không kiểm lại.
 *
 * Tệp được tải lên qua route upload thật vào thư mục tạm (đặt `UPLOADS_DIR`, như
 * document-linked-task-access.test.ts), không giả lập lưu trữ. Dữ liệu theo runId, dọn trong after().
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { DocumentStatus, FileScanStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEGACY_SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { POST as uploadRoute } from "@/app/api/upload/route";
import { POST as addAttachmentRoute } from "@/app/api/documents/[id]/attachments/route";
import { GET as getDocumentRoute } from "@/app/api/documents/[id]/route";
import {
  BASE_URL,
  bearer,
  createDocumentRouteFixture,
  getRequest,
  jsonRequest,
  routeContext,
  type FixtureUser,
} from "./documents-route-fixtures";

const fx = createDocumentRouteFixture("datt");
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "qcet-documents-attachments-"));
const previousUploadsDir = process.env.UPLOADS_DIR;

let registrar: FixtureUser;
let memberA: FixtureUser;
let outsider: FixtureUser;
let clerk: FixtureUser;
let docDraft = "";
let docDone = "";

interface UploadedFile {
  id: string;
  fileName: string;
  bytes: Buffer;
}
const files = {} as Record<"registrar" | "registrarSecond" | "member" | "outsider" | "clerk", UploadedFile>;
let infectedFileId = "";
let archivedFileId = "";

const attachPath = (id: string) => `/api/documents/${id}/attachments`;
const attachAs = (user: FixtureUser, id: string, body: unknown) =>
  addAttachmentRoute(jsonRequest(attachPath(id), { headers: bearer(user.token), body }), routeContext(id));
const attachmentCount = (documentId: string) => prisma.documentAttachment.count({ where: { documentId } });

async function upload(user: FixtureUser, key: string): Promise<UploadedFile> {
  const bytes = Buffer.from(`Tệp kiểm thử ${key} ${fx.runId} ${crypto.randomUUID()}`, "utf8");
  const fileName = `tep-${key}-${fx.runId}.txt`;
  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: "text/plain" }));
  const res = await uploadRoute(
    new NextRequest(`${BASE_URL}/api/upload`, { method: "POST", headers: bearer(user.token), body: form })
  );
  assert.equal(res.status, 200, "tải tệp fixture lên phải thành công");
  const body = await res.json();
  assert.equal(body.deduplicated, false);
  fx.trackFileObject(body.fileId);
  return { id: body.fileId, fileName: body.fileName, bytes };
}

async function assertJsonError(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.code, code);
  assert.equal(body.attachment, undefined, "lỗi không được kèm tệp đính kèm");
  return body;
}

describe("POST /api/documents/[id]/attachments", () => {
  before(async () => {
    process.env.UPLOADS_DIR = uploadsDir;
    const unitA = await fx.unit("A");
    const unitB = await fx.unit("B");
    const unitClerk = await fx.unit("HC");
    registrar = await fx.user("registrar", { unitId: unitA });
    memberA = await fx.user("memberA", { unitId: unitA });
    outsider = await fx.user("outsider", { unitId: unitB });
    // Văn thư có phân công chức danh VAN_THU ở đơn vị hành chính (không phải đơn vị chủ trì văn bản).
    clerk = await fx.user("clerk", { role: UserRole.VAN_THU, unitId: unitClerk });

    docDraft = (await fx.document({ registeredById: registrar.id, leadUnitId: unitA })).id;
    docDone = (
      await fx.document({ registeredById: registrar.id, leadUnitId: unitA, status: DocumentStatus.DA_HOAN_THANH })
    ).id;

    files.registrar = await upload(registrar, "registrar");
    files.registrarSecond = await upload(registrar, "registrar2");
    files.member = await upload(memberA, "member");
    files.outsider = await upload(outsider, "outsider");
    files.clerk = await upload(clerk, "clerk");

    for (const [key, extra] of [
      ["infected", { scanStatus: FileScanStatus.INFECTED }],
      ["archived", { isArchived: true }],
    ] as const) {
      const row = await prisma.fileObject.create({
        data: {
          storageKey: `documents-attachments-test/${fx.runId}-${key}.txt`,
          originalName: `${key}.txt`,
          mimeType: "text/plain",
          extension: ".txt",
          byteSize: BigInt(10),
          contentHash: crypto.createHash("sha256").update(`${fx.runId}-${key}`).digest("hex"),
          uploadedById: registrar.id,
          ...extra,
        },
      });
      fx.trackFileObject(row.id);
      if (key === "infected") infectedFileId = row.id;
      else archivedFileId = row.id;
    }
  });

  after(async () => {
    await fx.cleanup();
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  describe("xác thực, CSRF, định dạng request", () => {
    test("không có thông tin xác thực -> 401 AUTH_REQUIRED, không gắn tệp", async () => {
      const res = await addAttachmentRoute(
        jsonRequest(attachPath(docDraft), { body: { fileId: files.registrar.id } }),
        routeContext(docDraft)
      );
      await assertJsonError(res, 401, "AUTH_REQUIRED");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("cookie phiên nhưng thiếu Origin/Referer -> 403 CSRF_VALIDATION_FAILED, không gắn tệp", async () => {
      const res = await addAttachmentRoute(
        jsonRequest(attachPath(docDraft), {
          headers: { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${registrar.token}` },
          body: { fileId: files.registrar.id },
        }),
        routeContext(docDraft)
      );
      await assertJsonError(res, 403, "CSRF_VALIDATION_FAILED");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("Content-Type không phải JSON -> 415 UNSUPPORTED_MEDIA_TYPE", async () => {
      const res = await addAttachmentRoute(
        jsonRequest(attachPath(docDraft), {
          headers: bearer(registrar.token),
          contentType: "text/plain",
          rawBody: JSON.stringify({ fileId: files.registrar.id }),
        }),
        routeContext(docDraft)
      );
      await assertJsonError(res, 415, "UNSUPPORTED_MEDIA_TYPE");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("body JSON vượt 1MB -> 413 PAYLOAD_TOO_LARGE", async () => {
      const res = await attachAs(registrar, docDraft, { fileId: "x".repeat(1024 * 1024 + 16) });
      await assertJsonError(res, 413, "PAYLOAD_TOO_LARGE");
      assert.equal(await attachmentCount(docDraft), 0);
    });
  });

  describe("kiểm body", () => {
    const invalidBodies: Array<[string, unknown]> = [
      ["thiếu fileId", {}],
      ["fileId rỗng sau khi cắt khoảng trắng", { fileId: "   " }],
      ["fileId dài hơn 64 ký tự", { fileId: "a".repeat(65) }],
      ["fileId không phải chuỗi", { fileId: 123 }],
      ["có trường lạ (tên tệp do client gửi)", { fileId: "x", fileName: "gia-mao.pdf" }],
    ];
    for (const [label, body] of invalidBodies) {
      test(`${label} -> 400 VALIDATION_ERROR`, async () => {
        const res = await attachAs(registrar, docDraft, body);
        const json = await assertJsonError(res, 400, "VALIDATION_ERROR");
        assert.ok(json.fieldErrors && Object.keys(json.fieldErrors).length > 0);
        assert.equal(await attachmentCount(docDraft), 0);
      });
    }

    test("JSON hỏng -> 400 VALIDATION_ERROR", async () => {
      const res = await addAttachmentRoute(
        jsonRequest(attachPath(docDraft), { headers: bearer(registrar.token), rawBody: "{fileId:" }),
        routeContext(docDraft)
      );
      const json = await assertJsonError(res, 400, "VALIDATION_ERROR");
      assert.equal(json.message, "Invalid JSON body");
    });
  });

  describe("văn bản và quyền cập nhật", () => {
    test("văn bản không tồn tại -> 404 DOCUMENT_NOT_FOUND, tệp không bị gắn", async () => {
      const res = await attachAs(registrar, `${fx.runId}_khong_ton_tai`, { fileId: files.registrar.id });
      await assertJsonError(res, 404, "DOCUMENT_NOT_FOUND");
      assert.equal(await prisma.documentAttachment.count({ where: { fileObjectId: files.registrar.id } }), 0);
    });

    test("thành viên đơn vị đọc được nhưng không có quyền sửa -> 403 FORBIDDEN (dù gắn tệp của chính mình)", async () => {
      const res = await attachAs(memberA, docDraft, { fileId: files.member.id });
      const json = await assertJsonError(res, 403, "FORBIDDEN");
      assert.equal(json.message, "Bạn không có quyền bổ sung tệp cho văn bản này");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("người ngoài đơn vị, không đọc được văn bản -> 403 FORBIDDEN", async () => {
      const res = await attachAs(outsider, docDraft, { fileId: files.outsider.id });
      await assertJsonError(res, 403, "FORBIDDEN");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("văn bản đã hoàn thành (bất biến) -> 400 IMMUTABLE_DOCUMENT với cả người vào sổ", async () => {
      const res = await attachAs(registrar, docDone, { fileId: files.registrar.id });
      await assertJsonError(res, 400, "IMMUTABLE_DOCUMENT");
      assert.equal(await attachmentCount(docDone), 0);
    });
  });

  describe("tệp được gắn", () => {
    test("tệp do người khác tải lên -> 404 FILE_NOT_FOUND", async () => {
      const res = await attachAs(registrar, docDraft, { fileId: files.outsider.id });
      await assertJsonError(res, 404, "FILE_NOT_FOUND");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("mã tệp không tồn tại hoặc tệp đã lưu trữ -> 404 FILE_NOT_FOUND", async () => {
      for (const fileId of [crypto.randomUUID(), archivedFileId]) {
        const res = await attachAs(registrar, docDraft, { fileId });
        await assertJsonError(res, 404, "FILE_NOT_FOUND");
      }
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("tệp nhiễm mã độc -> 400 FILE_INFECTED", async () => {
      const res = await attachAs(registrar, docDraft, { fileId: infectedFileId });
      await assertJsonError(res, 400, "FILE_INFECTED");
      assert.equal(await attachmentCount(docDraft), 0);
    });

    test("người vào sổ gắn tệp của mình -> 200, metadata lấy từ máy chủ, ghi nhật ký, hiện ở chi tiết văn bản", async () => {
      const file = files.registrar;
      const res = await attachAs(registrar, docDraft, { fileId: file.id });
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
      assert.ok(res.headers.get("x-request-id"));

      const body = await res.json();
      assert.deepEqual(Object.keys(body), ["attachment"]);
      const { attachment } = body;
      assert.equal(attachment.documentId, docDraft);
      assert.equal(attachment.fileObjectId, file.id);
      assert.equal(attachment.fileUrl, `/api/file-objects/${file.id}`);
      assert.equal(attachment.fileName, file.fileName);
      assert.equal(attachment.fileSize, file.bytes.length);
      assert.equal(attachment.mimeType, "text/plain; charset=utf-8");
      assert.equal(attachment.sha256Hash, crypto.createHash("sha256").update(file.bytes).digest("hex"));
      assert.equal(attachment.isOriginal, false);

      const stored = await prisma.documentAttachment.findUniqueOrThrow({ where: { id: attachment.id } });
      assert.equal(stored.documentId, docDraft);
      assert.equal(stored.fileObjectId, file.id);

      const audit = await prisma.auditEvent.findFirst({
        where: { entityType: "Document", entityId: docDraft, action: "DOCUMENT_ATTACHMENT_ADDED" },
      });
      assert.ok(audit, "phải ghi nhật ký bổ sung tệp");
      assert.equal(audit.actorId, registrar.id);
      assert.equal((audit.metadata as { attachmentId?: string }).attachmentId, attachment.id);
      assert.equal(audit.requestId, res.headers.get("x-request-id"));

      const detail = await getDocumentRoute(getRequest(`/api/documents/${docDraft}`, bearer(registrar.token)), routeContext(docDraft));
      assert.equal(detail.status, 200);
      const detailBody = await detail.json();
      assert.ok(detailBody.data.attachments.some((a: { id: string }) => a.id === attachment.id));
    });

    test("Văn thư (chức danh VAN_THU, đơn vị khác) gắn tệp của mình vào văn bản nội bộ -> 200", async () => {
      const res = await attachAs(clerk, docDraft, { fileId: files.clerk.id });
      assert.equal(res.status, 200);
      const { attachment } = await res.json();
      assert.equal(attachment.documentId, docDraft);
      assert.equal(attachment.fileObjectId, files.clerk.id);
    });

    test("cookie phiên kèm Origin cùng nguồn -> 200", async () => {
      const res = await addAttachmentRoute(
        jsonRequest(attachPath(docDraft), {
          headers: { Cookie: `${LEGACY_SESSION_COOKIE_NAME}=${registrar.token}`, Origin: BASE_URL },
          body: { fileId: files.registrarSecond.id },
        }),
        routeContext(docDraft)
      );
      assert.equal(res.status, 200);
      const { attachment } = await res.json();
      assert.equal(attachment.fileObjectId, files.registrarSecond.id);
      assert.equal(await attachmentCount(docDraft), 3);
    });
  });
});
