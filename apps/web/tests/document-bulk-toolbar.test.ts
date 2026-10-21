import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DocumentBulkToolbar,
  canBulkAssignLeadUnit,
  groupBulkBatchFailures,
  resolveBulkBatchResult,
} from "../src/components/documents/registry/document-bulk-toolbar";
import * as registryExports from "../src/components/documents/registry";
import { AuthContext, type AuthContextType } from "../src/lib/auth-context";
import { documentCsvRows } from "../src/components/documents/registry/document-list-export";
import { toCsv } from "../src/lib/csv";
import type { OfficialDocument } from "@qcet/contracts/types/document";

function renderToolbarAs(dbRole: string | null) {
  // Thanh công cụ chỉ đọc `user.dbRole` từ ngữ cảnh đăng nhập
  const auth = {
    user: dbRole ? { id: "u-1", name: "Cán bộ", email: "cb@qcet.edu.vn", role: "STAFF", dbRole } : null,
  } as unknown as AuthContextType;
  return renderToStaticMarkup(
    React.createElement(
      AuthContext.Provider,
      { value: auth },
      React.createElement(DocumentBulkToolbar, {
        selectedCount: 2,
        selectedIds: ["doc-1", "doc-2"],
        onClearSelection: () => {},
      })
    )
  );
}

test("Document Bulk Toolbar: Exports & Contract Invariants", async (t) => {
  await t.test("exports DocumentBulkToolbar component function from registry module", () => {
    assert.strictEqual(typeof DocumentBulkToolbar, "function");
    assert.strictEqual(typeof registryExports.DocumentBulkToolbar, "function");
  });

  await t.test("Component function is defined with displayName or name", () => {
    assert.strictEqual(DocumentBulkToolbar.name, "DocumentBulkToolbar");
  });
});

test("Document Bulk Toolbar: thao tác theo quyền, không còn Hoàn tất hàng loạt", async (t) => {
  await t.test("lãnh đạo có quyền bút phê thấy Giao đơn vị và Lưu hồ sơ", () => {
    const html = renderToolbarAs("BAN_GIAM_HIEU");
    assert.ok(html.includes("Giao đơn vị"));
    assert.ok(html.includes("Lưu hồ sơ"));
    assert.equal(html.includes("Hoàn tất"), false);
  });

  await t.test("Văn thư chỉ thấy Lưu hồ sơ", () => {
    const html = renderToolbarAs("VAN_THU");
    assert.equal(html.includes("Giao đơn vị"), false);
    assert.ok(html.includes("Lưu hồ sơ"));
    assert.equal(html.includes("Hoàn tất"), false);
  });

  await t.test("quyền giao đơn vị lấy từ cùng nguồn với nút bút phê văn bản đến", () => {
    assert.equal(canBulkAssignLeadUnit("BAN_GIAM_HIEU"), true);
    for (const role of ["VAN_THU", "TRUONG_PHONG", "CHUYEN_VIEN", null, undefined]) {
      assert.equal(canBulkAssignLeadUnit(role), false, `role ${role}`);
    }
  });
});

test("Document Bulk Toolbar: gom lý do các văn bản không xử lý được", () => {
  const groups = groupBulkBatchFailures([
    { documentId: "a", error: "Không thể chuyển trạng thái văn bản đến từ 'REGISTERED' sang 'FILED'." },
    { documentId: "b", error: "Thao tác không áp dụng cho loại văn bản này." },
    { documentId: "c", error: "Không thể chuyển trạng thái văn bản đến từ 'REGISTERED' sang 'FILED'." },
    { documentId: "d" },
  ]);
  assert.deepEqual(groups, [
    { reason: "Không thể chuyển trạng thái văn bản đến từ 'REGISTERED' sang 'FILED'.", count: 2 },
    { reason: "Thao tác không áp dụng cho loại văn bản này.", count: 1 },
    { reason: "Không xử lý được văn bản.", count: 1 },
  ]);
  assert.deepEqual(groupBulkBatchFailures([]), []);
});

test("Document Bulk Toolbar: bỏ chọn khi lô có văn bản đã xử lý, kể cả khi một phần lỗi", async (t) => {
  await t.test("một phần lỗi: hiện kết quả và bỏ chọn để bấm lại không chạy lại văn bản đã xong", () => {
    const result = resolveBulkBatchResult(
      {
        total: 3,
        successCount: 2,
        failed: [{ documentId: "c", error: "Văn bản đã được lưu hồ sơ." }],
      },
      3
    );
    assert.equal(result.clearSelection, true);
    assert.deepEqual(result.outcome, {
      successCount: 2,
      failureCount: 1,
      total: 3,
      failures: [{ reason: "Văn bản đã được lưu hồ sơ.", count: 1 }],
    });
  });

  await t.test("tất cả lỗi: giữ lựa chọn để sửa thông tin rồi thử lại", () => {
    const result = resolveBulkBatchResult(
      { total: 2, successCount: 0, failed: [{ documentId: "a" }, { documentId: "b" }] },
      2
    );
    assert.equal(result.clearSelection, false);
    assert.equal(result.outcome?.failureCount, 2);
    assert.equal(result.outcome?.successCount, 0);
  });

  await t.test("tất cả thành công: không có kết quả lỗi, bỏ chọn", () => {
    assert.deepEqual(resolveBulkBatchResult({ total: 2, successCount: 2, failed: [] }, 2), {
      outcome: null,
      clearSelection: true,
    });
  });
});

test("Document Bulk Toolbar: sao chép liên kết và xuất Excel các văn bản đang chọn (21/10/2026)", async (t) => {
  const doc = {
    id: "doc-1",
    type: "inbox",
    documentNumber: "=12/SGDĐT-VP",
    registrationNumber: 7,
    issuedDate: "2026-10-12",
    dueDate: "2026-10-20",
    issuingAuthority: "Sở Giáo dục và Đào tạo",
    summary: "Về việc báo cáo tuyển sinh",
    urgency: "urgent",
    status: "pending_assignment",
    leadDepartment: "Chưa phân công",
    signatory: "",
  } as unknown as OfficialDocument;

  await t.test("có văn bản đang chọn thì thanh có Sao chép liên kết và Xuất Excel", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: { user: null } as unknown as AuthContextType },
        React.createElement(DocumentBulkToolbar, { selectedCount: 1, selectedIds: ["doc-1"], selectedDocuments: [doc], onClearSelection: () => {} })
      )
    );
    assert.ok(html.includes("Xuất Excel"));
    assert.ok(html.includes("Sao chép liên kết"));
    assert.ok(html.includes("Lưu hồ sơ"));
  });

  await t.test("bảng CSV theo cột của sổ, số đến 4 chữ số, chặn công thức ở đầu ô", () => {
    const [header, line] = toCsv(documentCsvRows([doc], "Số đến")).split("\r\n");
    assert.equal(header, '"Số đến","Số, ký hiệu","Ngày ban hành","Cơ quan ban hành","Trích yếu","Mức khẩn","Đơn vị chủ trì","Hạn xử lý","Bước xử lý"');
    assert.ok(line.startsWith(`"0007","'=12/SGDĐT-VP","12/10/2026","Sở Giáo dục và Đào tạo","Về việc báo cáo tuyển sinh","Khẩn","","20/10/2026",`), line);
  });
});
