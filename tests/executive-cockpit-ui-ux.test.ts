import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Executive Cockpit UI/UX Enhancements", () => {
  const workspacePath = path.resolve(
    process.cwd(),
    "src/components/portal/executive-cockpit-workspace.tsx"
  );
  const briefingModalPath = path.resolve(
    process.cwd(),
    "src/components/portal/executive-briefing-modal.tsx"
  );

  it("xác nhận tệp executive-briefing-modal.tsx tồn tại và export ExecutiveBriefingModal", () => {
    assert.strictEqual(
      fs.existsSync(briefingModalPath),
      true,
      "Tệp executive-briefing-modal.tsx phải tồn tại"
    );
    const code = fs.readFileSync(briefingModalPath, "utf-8");
    assert.match(
      code,
      /export\s+(?:const|function)\s+ExecutiveBriefingModal/,
      "Phải export ExecutiveBriefingModal"
    );
  });

  it("xác nhận executive-briefing-modal hỗ trợ chức năng In báo cáo và Xuất Markdown", () => {
    const code = fs.readFileSync(briefingModalPath, "utf-8");
    assert.match(
      code,
      /window\.print\(\)/,
      "Phải tích hợp lệnh in ấn tiêu chuẩn window.print()"
    );
    assert.match(
      code,
      /handleExportMarkdown/,
      "Phải tích hợp chức năng xuất báo cáo định dạng Markdown"
    );
    assert.match(
      code,
      /print:hidden|@media\s+print/,
      "Phải có CSS ẩn các nút điều hướng khi in báo cáo giao ban"
    );
  });

  it("xác nhận nút 'Báo cáo giao ban' xuất hiện trên thanh header điều hành BGH", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");
    assert.match(
      code,
      /Báo cáo giao ban/,
      "Header phải có nút Báo cáo giao ban"
    );
    assert.match(
      code,
      /setShowBriefingModal\(true\)/,
      "Nút Báo cáo giao ban phải kích hoạt mở ExecutiveBriefingModal"
    );
  });

  it("xác nhận thanh công cụ của Hàng đợi phê duyệt hỗ trợ bộ lọc phân loại đề tài", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");
    assert.match(
      code,
      /approvalCategory/,
      "Workspace phải có state approvalCategory"
    );
    assert.match(
      code,
      /Đề án & Kế hoạch/,
      "Phải có tùy chọn lọc Đề án & Kế hoạch"
    );
    assert.match(
      code,
      /Kiểm định & Khảo thí/,
      "Phải có tùy chọn lọc Kiểm định & Khảo thí"
    );
    assert.match(
      code,
      /Cơ sở & Thiết bị/,
      "Phải có tùy chọn lọc Cơ sở & Thiết bị"
    );
  });

  it("xác nhận Radar sức khỏe 11 đơn vị hỗ trợ tính năng sắp xếp đa chiều", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");
    assert.match(
      code,
      /unitSortBy/,
      "Workspace phải có state unitSortBy"
    );
    assert.match(
      code,
      /Cảnh báo \(Đỏ trước\)/,
      "Phải có chế độ xếp theo mức cảnh báo"
    );
    assert.match(
      code,
      /Tiến độ cao nhất/,
      "Phải có chế độ xếp theo tiến độ hoàn thành"
    );
    assert.match(
      code,
      /Tên A-Z/,
      "Phải có chế độ xếp theo thứ tự bảng chữ cái"
    );
  });

  it("xác nhận Banner phân luồng can thiệp lãnh đạo được hiển thị ở Tab Điểm nghẽn", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");
    assert.match(
      code,
      /Phân luồng can thiệp lãnh đạo:/,
      "Tab Điểm nghẽn phải có banner hướng dẫn phân luồng thẩm quyền BGH"
    );
    assert.match(
      code,
      /Đôn đốc tất cả/,
      "Phải có nút đôn đốc nhanh toàn bộ các đơn vị gặp tắc nghẽn"
    );
  });

  it("xác nhận zero decorative emojis và chuẩn tabular-nums trong cả 2 tệp giao diện", () => {
    const files = [workspacePath, briefingModalPath];
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const emojiMatch = content.match(new RegExp(emojiRegex, "gu"));
      assert.strictEqual(
        emojiMatch,
        null,
        `Tệp ${path.basename(filePath)} không được chứa emoji trang trí`
      );
      assert.match(
        content,
        /tabular-nums/,
        `Tệp ${path.basename(filePath)} phải sử dụng tabular-nums cho các chỉ số`
      );
    }
  });

  it("xác nhận bảo toàn tuyệt đối các bất biến kiến trúc cốt lõi của khoang BGH", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");
    // 1. Header đơn 56px
    assert.match(code, /min-h-\[56px\]/);
    // 2. Không có lời chào dư thừa
    assert.doesNotMatch(code, /Xin chào,/);
    // 3. Quy chuẩn 70/30
    assert.match(code, /lg:grid-cols-12/);
    assert.match(code, /lg:col-span-8/);
    assert.match(code, /lg:col-span-4/);
    // 4. Hero KPI card
    assert.match(code, /min-h-\[110px\]/);
    assert.match(code, /border-rose-500\/60/);
    assert.match(code, /border-emerald-500\/40/);
    // 5. Tích hợp Drawer và Cards
    assert.match(code, /<ExecutiveResolutionDrawer/);
    assert.match(code, /<ExecutiveBottleneckCard/);
    assert.match(code, /<ExecutiveUnitRadar/);
  });

  it("Optimistic Resolution Undo banner is positioned fixed above mobile bottom nav with safe-area", () => {
    const content = fs.readFileSync(workspacePath, "utf-8");
    assert.ok(
      content.includes("fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]") &&
      content.includes("z-40"),
      "Undo banner must be anchored above mobile bottom nav"
    );
  });

  it("xác nhận các nút hành động gỡ nghẽn trên mobile đạt chuẩn công thái học min-h-[40px] hoặc min-h-[38px]", () => {
    const content = fs.readFileSync(workspacePath, "utf-8");
    assert.ok(
      content.includes("min-h-[40px]") ||
      content.includes("min-h-[38px]") ||
      content.includes("h-10 sm:h-8"),
      "Các nút hành động phải có kích thước tối thiểu công thái học min-h-[40px]"
    );
  });
});
