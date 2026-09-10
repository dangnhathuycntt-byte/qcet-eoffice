# Architecture Decision Records (ADRs)

Thư mục này ghi nhận các quyết định kiến trúc quan trọng (Architecture Decision Records) của hệ thống QCET E-Office.

## Cấu trúc ADR

Mỗi ADR được đánh số tuần tự theo định dạng `ADR-XXXX-<slug>.md` và bao gồm các mục:
1. **Tiêu đề**: Tóm tắt ngắn gọn quyết định.
2. **Trạng thái**: `Proposed` | `Accepted` | `Superseded` | `Deprecated`.
3. **Bối cảnh**: Vấn đề kỹ thuật, yêu cầu thể chế hoặc quy định pháp luật thúc đẩy quyết định.
4. **Quyết định**: Giải pháp kiến trúc canonical được chọn.
5. **Hệ quả**: Ưu điểm, nhược điểm, và các ràng buộc đi kèm.

## Danh mục quyết định then chốt

- **ADR-0001**: Kiến trúc phân quyền Hybrid Canonical Authorization Engine (ABAC/RBAC/DAC) & Single Authority Model (xem chi tiết tại `docs/domain/authority.md`).
- **ADR-0002**: Lọc quyền trước phân trang (Pre-Pagination Security ACL) cho toàn bộ văn bản và nhiệm vụ (xem chi tiết tại `docs/domain/authority.md`).
- **ADR-0003**: Mô hình bảo mật lưu trữ tập tin biệt lập (Strict Private File Storage Boundary) và Stream Streaming Security (xem chi tiết tại `docs/security/file-storage.md`).
- **ADR-0004**: Cơ chế kiểm soát đồng thời lạc quan (Optimistic Concurrency Control - OCC) cho các thực thể cốt lõi Task, Document, Organization (xem chi tiết tại `docs/architecture/DATABASE_OPERATIONS.md`).
- **ADR-0005**: Thiết kế giao diện Light-Only, Zero-Emoji và tuân thủ WCAG 2.2 AA (xem chi tiết tại `DESIGN.md`).
