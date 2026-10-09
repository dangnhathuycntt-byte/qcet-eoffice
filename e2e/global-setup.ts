import fs from "node:fs";
import path from "node:path";
import {
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentType,
  DocumentUrgency,
  PrismaClient,
  UnitStatus,
  UnitType,
  UserRole,
} from "@prisma/client";
import { signSessionToken } from "../src/lib/jwt-session";
import { E2E_AUTH_FILE, E2E_BASE_URL, E2E_TMP, E2E_UPLOADS, resolveE2eDatabaseUrl } from "./env";
import {
  DOC_LONG_ID,
  DOC_MIXED_ID,
  DOC_OUTGOING_ID,
  DOC_SUBMISSION_ID,
  E2E_FILE_COUNTS,
  E2E_UNIT_ID,
  E2E_USER_ID,
  attachmentId,
  docIdForFiles,
} from "./fixtures";
import { buildPdf, corruptPdf, type PdfPageSpec } from "./support/pdf";

interface FileSpec {
  name: string;
  data: Buffer;
  mimeType: string;
}

const pdf = (name: string, pages: PdfPageSpec[]): FileSpec => ({ name, data: buildPdf(pages), mimeType: "application/pdf" });
const simplePages = (count: number): PdfPageSpec[] => Array.from({ length: count }, (_, i) => ({ text: `Trang ${i + 1}` }));

function mixedFiles(): FileSpec[] {
  return [
    pdf("a4-doc.pdf", simplePages(3)),
    pdf("ngang.pdf", [{ width: 842, height: 595, text: "Trang ngang" }]),
    pdf("kho-la.pdf", [{ width: 300, height: 1200, text: "Khổ lạ" }]),
    pdf("xoay-90.pdf", [{ rotate: 90, text: "Xoay 90" }]),
    pdf("scan-khong-text.pdf", [{ text: null }]),
    { name: "hong.pdf", data: corruptPdf(), mimeType: "application/pdf" },
  ];
}

async function main() {
  const databaseUrl = resolveE2eDatabaseUrl();
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    fs.rmSync(E2E_TMP, { recursive: true, force: true });
    fs.mkdirSync(path.join(E2E_UPLOADS, "documents/e2e"), { recursive: true });

    // Dọn dữ liệu E2E cũ (chỉ các bản ghi có tiền tố e2e_) rồi tạo lại để kết quả xác định.
    const oldDocs = await prisma.document.findMany({ where: { id: { startsWith: "e2e_" } }, select: { id: true } });
    const oldIds = oldDocs.map((d) => d.id);
    await prisma.documentAttachment.deleteMany({ where: { documentId: { in: oldIds } } });
    await prisma.documentIncomingWorkflow.deleteMany({ where: { documentId: { in: oldIds } } });
    await prisma.documentOutgoingWorkflow.deleteMany({ where: { documentId: { in: oldIds } } });    await prisma.document.deleteMany({ where: { id: { in: oldIds } } });
    await prisma.positionAssignment.deleteMany({ where: { userId: E2E_USER_ID } });
    await prisma.user.deleteMany({ where: { id: E2E_USER_ID } });
    await prisma.organizationalUnit.deleteMany({ where: { id: E2E_UNIT_ID } });

    await prisma.organizationalUnit.create({
      data: { id: E2E_UNIT_ID, code: E2E_UNIT_ID, name: "Đơn vị E2E", type: UnitType.DEPARTMENT, status: UnitStatus.ACTIVE },
    });
    const user = await prisma.user.create({
      data: { id: E2E_USER_ID, email: "e2e_user@qcet.edu.vn", name: "Người dùng E2E", role: UserRole.CHUYEN_VIEN },
    });
    const def = await prisma.positionDefinition.upsert({
      where: { code: "CHUYEN_VIEN" },
      update: {},
      create: { code: "CHUYEN_VIEN", title: "Chuyên viên", group: "VCDC" },
    });
    await prisma.positionAssignment.create({
      data: { userId: user.id, positionDefinitionId: def.id, unitId: E2E_UNIT_ID, type: "PRIMARY", status: "ACTIVE" },
    });

    let serial = 0;
    async function createDocument(id: string, label: string, files: FileSpec[], type: DocumentType = DocumentType.VAN_BAN_DEN) {
      serial += 1;
      const attachments = files.map((file, index) => {
        const rel = `documents/e2e/${id}-${index + 1}-${file.name}`;
        fs.writeFileSync(path.join(E2E_UPLOADS, rel), file.data);
        return {
          id: attachmentId(id, index),
          fileName: file.name,
          fileUrl: rel,
          fileSize: file.data.length,
          mimeType: file.mimeType,
          isOriginal: index === 0,
        };
      });
      await prisma.document.create({
        data: {
          id,
          registrationNumber: 900000 + serial,
          originalNumber: `E2E-${serial}`,
          issuedDate: new Date("2026-03-02T00:00:00Z"),
          issuingAuthority: "Cơ quan E2E",
          category: "CONG_VAN",
          summary: label,
          type,
          documentYear: 2026,
          registeredDate: new Date("2026-03-02T00:00:00Z"),
          securityLevel: DocumentSecurityLevel.THUONG,
          urgency: DocumentUrgency.THUONG,
          status: DocumentStatus.CHO_PHAN_CONG,
          registeredById: user.id,
          ...(type === DocumentType.VAN_BAN_DEN ? { incomingWorkflow: { create: { leadUnitId: E2E_UNIT_ID } } } : {}),
          ...(type === DocumentType.VAN_BAN_DI ? { outgoingWorkflow: { create: { status: "DRAFT" } } } : {}),
          attachments: { create: attachments },
        },
      });
    }

    for (const count of E2E_FILE_COUNTS) {
      const files = Array.from({ length: count }, (_, i) => pdf(`tep-${i + 1}.pdf`, simplePages(2 + (i % 3))));
      await createDocument(docIdForFiles(count), `Văn bản E2E ${count} tệp`, files);
    }
    await createDocument(DOC_LONG_ID, "Văn bản E2E một tệp 60 trang", [pdf("dai-60-trang.pdf", simplePages(60))]);
    await createDocument(DOC_OUTGOING_ID, "Văn bản đi E2E hai tệp", [pdf("du-thao.pdf", simplePages(3)), pdf("phu-luc.pdf", simplePages(2))], DocumentType.VAN_BAN_DI);
    await createDocument(DOC_SUBMISSION_ID, "Tờ trình E2E ba tệp", [pdf("to-trinh.pdf", simplePages(2)), pdf("phu-luc-1.pdf", simplePages(1)), pdf("phu-luc-2.pdf", simplePages(1))], DocumentType.TO_TRINH_NOI_BO);
    await createDocument(DOC_MIXED_ID, "Văn bản E2E tệp đa dạng khổ giấy", mixedFiles());

    // Phiên đăng nhập: cookie JWT ký bằng AUTH_SECRET của E2E, không lưu vào Git (playwright/.auth/ đã ignore).
    const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    fs.mkdirSync(path.dirname(E2E_AUTH_FILE), { recursive: true });
    fs.writeFileSync(
      E2E_AUTH_FILE,
      JSON.stringify({
        cookies: [
          {
            name: "authjs.session-token",
            value: token,
            domain: new URL(E2E_BASE_URL).hostname,
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

export default main;
