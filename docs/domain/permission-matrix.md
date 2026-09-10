# MA TRẬN PHÂN QUYỀN & THẨM QUYỀN TÁC NGHIỆP TOÀN DIỆN (COMPREHENSIVE PERMISSION & AUTHORITY MATRIX)
## QCET E-OFFICE CANONICAL DOMAIN SPECIFICATION

**Cơ quan chủ quản:** Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET)  
**Phân hệ:** Ma trận Phân quyền & Năng lực Thể chế (Institutional Permission Matrix)  
**Tình trạng tài liệu:** Đặc tả Chuẩn tắc (Canonical Reference Specification)  
**Mã tài liệu:** `QCET-AUTH-MATRIX-2026-01`  
**Phiên bản:** 1.0.0 (Cập nhật tháng 09/2026)  
**Tài liệu nền tảng liên kết:**
- `docs/domain/authority.md`: Kiến trúc Ủy quyền & Động cơ Phân quyền Năng lực Cốt lõi.
- `docs/domain/regulations_knowledge_base.md`: Cơ sở Tri thức Pháp lý & Quy chế Điều hành Tổ chức.
- `docs/product/roles-and-scopes.md`: Ranh giới Vai trò và Phạm vi Dữ liệu (Role Is Not Scope).

---

## 1. TỔNG QUAN KIẾN TRÚC MA TRẬN PHÂN QUYỀN

Ma trận phân quyền trong QCET E-Office không phải là danh sách đánh dấu tĩnh (Static Checkbox List) mà là một cấu trúc không gian 4 chiều phản ánh sự kết hợp giữa:
1. **Trục Chức vụ / Vị trí (Position - RBAC)**: Định vị thẩm quyền thể chế theo Nghị định 232/2026/NĐ-CP và QĐ 282/QĐ-CĐKTCNQN.
2. **Trục Mảng công tác / Lĩnh vực phụ trách (Portfolio - ABAC)**: Phân công nhiệm vụ cụ thể của Thường trực Ban Giám hiệu theo Quyết định số 420/QĐ-CĐKTCNQN.
3. **Trục Mối quan hệ Thực thể (Resource Relationship - ReBAC)**: Mối ràng buộc thực tế giữa người dùng với nhiệm vụ, văn bản hoặc hồ sơ công việc (Chủ trì, Phối hợp, Người tạo, Người ký, Người kiểm tra).
4. **Trục Danh mục Năng lực (Capability Catalog)**: Các hành động nghiệp vụ nguyên tử được định danh chuẩn hóa.

```
       ┌───────────────────────────────────────────────────────────┐
       │              4-DIMENSIONAL AUTHORIZATION SPACE            │
       │                                                           │
       │   [Position (RBAC)] ──┬── [Portfolio (ABAC)]              │
       │                       │                                   │
       │                       ▼                                   │
       │              [Capability Action]                          │
       │                       ▲                                   │
       │                       │                                   │
       │   [Relationship (ReBAC)] ──┴── [Constraints (SoD/Legal)]  │
       └───────────────────────────────────────────────────────────┘
```

---

## 2. ĐỊNH NGHĨA CÁC VỊ TRÍ CHỨC DANH CHUẨN TẮC (POSITIONS)

| Mã vị trí (Position Code) | Ch��c danh thể chế | Mã hiệu điều hành | Căn cứ pháp lý | Phạm vi thẩm quyền mặc định |
|---|---|:---:|---|---|
| `HIEU_TRUONG` | Hiệu trưởng | `BGH_HT` | QĐ 420, Điều 12 TT 63/2026 | Toàn diện mọi mặt hoạt động của Nhà trường; Chủ tài khoản cơ quan. |
| `PHO_HIEU_TRUONG_DT` | Phó Hiệu trưởng Đào tạo | `BGH_PHT_DT` | QĐ 420, Điều 13 TT 63/2026 | Chỉ đạo mảng Đào tạo, Khảo thí, Chuyển đổi số, CNTT, NCKH, các Khoa chuyên môn. |
| `PHO_HIEU_TRUONG_HC` | Phó Hiệu trưởng HC-CSVC | `BGH_PHT_CSVC` | QĐ 420, Điều 13 TT 63/2026 | Chỉ đạo mảng Hành chính, Tổng hợp, Văn thư, Cơ sở vật chất, Tài sản, Tuyển sinh. |
| `TRUONG_DON_VI` | Trưởng đơn vị (Trưởng phòng, Trưởng khoa, GĐ Trung tâm) | `TRUONG_DON_VI` | QĐ 203, Điều 15 TT 63/2026 | Toàn diện hoạt động nội bộ của đơn vị; phân công giao việc và duyệt sản phẩm cấp phòng/khoa. |
| `PHO_TRUONG_DON_VI` | Phó Trưởng đơn vị (Phó phòng, Phó khoa, Phó GĐ Trung tâm) | `PHO_DON_VI` | QĐ 203, TT 63/2026 | Thực thi nhiệm vụ chuyên môn và thực hiện quyền duyệt khi có ủy quyền (`DacumDelegation`). |
| `GIANG_VIEN_CHUYEN_VIEN` | Giảng viên, Giáo viên GDNN, Chuyên viên nghiệp vụ | `VIEN_CHUC` | NĐ 232/2026, QĐ 203 | Trực tiếp thực thi công việc, nộp sản phẩm minh chứng, soạn thảo dự thảo văn bản. |
| `VAN_THU` | Cán bộ Văn thư cơ quan | `VAN_THU` | NĐ 30/2020, QĐ 93 | Quản lý sổ văn bản đi/đến, cấp số tự động, kiểm tra thể thức, đóng dấu điện tử cơ quan. |
| `LUU_TRU` | Cán bộ Lưu trữ cơ quan | `LUU_TRU` | QĐ 93, Kế hoạch 227 | Tiếp nhận hồ sơ công việc số nộp lưu, phân loại thời hạn bảo quản, quản trị kho lưu trữ số. |
| `QUAN_TRI_HE_THONG` | Kỹ sư Quản trị hệ thống | `ADMIN` | Luật An toàn thông tin mạng | Quản trị người dùng, phân cấp đơn vị, cấu hình kỹ thuật, giám sát nhật ký an ninh. |

---

## 3. MA TRẬN NĂNG LỰC CHI TIẾT (THE MASTER CAPABILITY MATRIX)

### Quy ước ký hiệu trong bảng:
- `✓ (Full)`: Được phép thực hiện vô điều kiện theo thẩm quyền vị trí.
- `✓ (Scope)`: Được phép thực hiện trong phạm vi đơn vị hoặc phạm vi mảng phụ trách được phân công.
- `✓ (Rel)`: Được phép thực hiện khi thỏa mãn điều kiện quan hệ thực thể (ReBAC - ví dụ: là người tạo, người chủ trì).
- `✓ (Del)`: Được phép thực hiện khi có văn bản ủy quyền hợp lệ còn hiệu lực (`DacumDelegation`).
- `✗ (Deny)`: Bị hệ thống từ chối truy cập (403 Forbidden).
- `[SoD]`: Cưỡng chế quy tắc phân lập trách nhiệm (Separation of Duties).

---

### 3.1. Phân hệ Quản lý Nhiệm vụ (Task Capabilities)

| Năng lực (Capability) | `HIEU_TRUONG` | `PHO_HIEU_TRUONG` | `TRUONG_DON_VI` | `PHO_TRUONG_DON_VI` | `GIANG_VIEN_CHUYEN_VIEN` | `VAN_THU` | `LUU_TRU` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `task.view` | ✓ (Toàn trường) | ✓ (Toàn trường) | ✓ (Đơn vị + Được giao) | ✓ (Đơn vị + Được giao) | ✓ (Việc được giao + Đơn vị phối hợp) | ✓ (Việc liên kết VB) | ✓ (Việc trong hồ sơ nộp) | ✓ (Chỉ gỡ lỗi kỹ thuật: Bắt buộc che mặt nạ dữ liệu nhạy cảm, cấm xem tệp đính kèm bí mật, ghi nhật ký kiểm toán mức cao) |
| `task.create` | ✓ (Cấp trường / ĐV) | ✓ (Mảng phụ trách) | ✓ (Cấp Đơn vị / Con) | ✓ (Nhiệm vụ nội bộ) | ✓ (Nhiệm vụ cá nhân) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.assign` | ✓ (Chỉ đạo toàn trường) | ✓ (Giao đơn vị phụ trách) | ✓ (Giao viên chức thuộc ĐV) | ✓ (Del - Khi ủy quyền) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.reassign` | ✓ (Toàn quyền điều chuyển) | ✓ (Điều chuyển trong mảng) | ✓ (Điều chuyển trong ĐV) | ✓ (Del - Khi ủy quyền) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.update_execution` | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Chủ trì / Phối hợp) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.submit_result` | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Nếu là Owner) | ✓ (Rel: Chủ trì / Phối hợp) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.review` | ✓ (Cấp trường) [SoD] | ✓ (Mảng phụ trách) [SoD] | ✓ (Viên chức thuộc ĐV) [SoD] | ✓ (Del - Ủy quyền) [SoD] | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.approve` | ✓ (Nhiệm vụ toàn trường) [SoD] | ✓ (Nhiệm vụ thuộc mảng) [SoD] | ✓ (Nhiệm vụ thuộc ĐV) [SoD] | ✓ (Del - Ủy quyền) [SoD] | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.monitor` | ✓ (Toàn trường) | ✓ (Toàn trường) | ✓ (Toàn bộ Đơn vị) | ✓ (Đơn vị) | ✓ (Cá nhân) | ✗ (Deny) | ✗ (Deny) | ✓ (Giám sát tải hệ thống) |
| `task.remind` | ✓ (Toàn trường) | ✓ (Đơn vị thuộc mảng) | ✓ (Cán bộ trong ĐV) | ✓ (Cán bộ trong ĐV) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.close` | ✓ (Nhiệm vụ toàn trường) | ✓ (Nhiệm vụ mảng) | ✓ (Nhiệm vụ ĐV) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `task.cancel` | ✓ (Mọi nhiệm vụ) | ✓ (Nhiệm vụ mảng) | ✓ (Nhiệm vụ ĐV tự tạo) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |

---

### 3.2. Phân hệ Quản lý Văn bản Đến (Incoming Document Capabilities - NĐ 30/2020)

| Năng lực (Capability) | `HIEU_TRUONG` | `PHO_HIEU_TRUONG` | `TRUONG_DON_VI` | `PHO_TRUONG_DON_VI` | `GIANG_VIEN_CHUYEN_VIEN` | `VAN_THU` | `LUU_TRU` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `document.incoming.register` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Quyền riêng) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.incoming.present` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Trình BGH) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.incoming.direct` | ✓ (Mọi văn bản đến) | ✓ (Văn bản thuộc mảng QĐ420) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.incoming.assign_unit` | ✓ (Chỉ định ĐV chủ trì) | ✓ (Chỉ định ĐV thuộc mảng) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.incoming.assign_person` | ✗ (Không làm thay cấp dưới) | ✗ (Không làm thay cấp dưới) | ✓ (Chỉ định CB thụ lý trong ĐV) | ✓ (Del - Khi ủy quyền) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.incoming.execute` | ✓ (Rel: Nếu trực tiếp làm) | ✓ (Rel: Nếu trực tiếp làm) | ✓ (Rel: Nếu trực tiếp làm) | ✓ (Rel: Được phân công) | ✓ (Rel: Được phân công) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |

---

### 3.3. Phân hệ Quản lý Văn bản Đi (Outgoing Document Capabilities - NĐ 30/2020)

| Năng lực (Capability) | `HIEU_TRUONG` | `PHO_HIEU_TRUONG` | `TRUONG_DON_VI` | `PHO_TRUONG_DON_VI` | `GIANG_VIEN_CHUYEN_VIEN` | `VAN_THU` | `LUU_TRU` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `document.outgoing.draft` | ✓ (Tạo dự thảo) | ✓ (Tạo dự thảo) | ✓ (Tạo dự thảo ĐV) | ✓ (Tạo dự thảo ĐV) | ✓ (Soạn thảo văn bản) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.outgoing.review_content`| ✓ (Toàn trường) | ✓ (Văn bản thuộc mảng) | ✓ (Duyệt nội dung ĐV) | ✓ (Del - Khi ủy quyền) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.outgoing.review_format` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Kiểm tra Phụ lục I) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.outgoing.sign` | ✓ (Ký chính thức / Quyết định) | ✗ (Dùng sign_kt) | ✗ (Không ký chức danh HT) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) [SoD] | ✗ (Deny) [SoD] | ✗ (Deny - SoP) |
| `document.outgoing.sign_kt` | ✗ (Hiệu trưởng ký trực tiếp) | ✓ (KT. Hiệu trưởng theo QĐ420) | ✗ (Không ký cấp trường) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) [SoD] | ✗ (Deny) [SoD] | ✗ (Deny - SoP) |
| `document.outgoing.sign_tuq` | ✗ (Không tự TUQ chính mình) | ✗ (Chỉ ký KT.) | ✓ (TUQ. Hiệu trưởng khi có DelegationGrant) | ✗ (Cấm tái ủy quyền) | ✗ (Deny) | ✗ (Deny) [SoD] | ✗ (Deny) [SoD] | ✗ (Deny - SoP) |
| `document.outgoing.number` | ✗ (Deny) [SoD] | ✗ (Deny) [SoD] | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Cấp số từ Sequence) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.outgoing.organization_sign`| ✗ (Deny) [SoD] | ✗ (Deny) [SoD] | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Đóng dấu số cơ quan) | ✗ (Deny) | ✗ (Deny - SoP) |
| `document.outgoing.issue` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Phát hành chính thức) | ✗ (Deny) | ✗ (Deny - SoP) |

---

### 3.4. Phân hệ Hồ sơ Công việc & Lưu trữ (Dossier & Archive - QĐ 93, KH 227)

| Năng lực (Capability) | `HIEU_TRUONG` | `PHO_HIEU_TRUONG` | `TRUONG_DON_VI` | `PHO_TRUONG_DON_VI` | `GIANG_VIEN_CHUYEN_VIEN` | `VAN_THU` | `LUU_TRU` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `dossier.open` | ✓ (Mở hồ sơ chiến lược) | ✓ (Mở hồ sơ đề án mảng) | ✓ (Mở hồ sơ công tác ĐV) | ✓ (Mở hồ sơ chuyên môn) | ✓ (Mở hồ sơ công việc) | ✓ (Mở hồ sơ văn thư) | ✓ (Mở hồ sơ lưu trữ) | ✗ (Deny - SoP) |
| `dossier.add_item` | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình/ĐV) | ✓ (Rel: Hồ sơ của mình/ĐV) | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình) | ✗ (Không chèn hồ sơ ĐV) | ✗ (Deny - SoP) |
| `dossier.close` | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình/ĐV) | ✓ (Rel: Hồ sơ của mình/ĐV) | ✓ (Rel: Hồ sơ của mình) | ✓ (Rel: Hồ sơ của mình) | ✗ (Deny) | ✗ (Deny - SoP) |
| `dossier.transfer_archive` | ✓ (Nộp lưu hồ sơ BGH) | ✓ (Nộp lưu hồ sơ BGH) | ✓ (Nộp lưu hồ sơ Đơn vị) | ✓ (Nộp lưu hồ sơ Đơn vị) | ✓ (Nộp lưu hồ sơ cá nhân) | ✓ (Nộp lưu sổ văn bản) | ✗ (Deny) | ✗ (Deny - SoP) |
| `dossier.accept_archive` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Thẩm định nộp lưu) | ✗ (Deny - SoP) |

---

### 3.5. Phân hệ Quản trị Hệ thống & Hạ tầng Kỹ thuật (System Administration)

| Năng lực (Capability) | `HIEU_TRUONG` | `PHO_HIEU_TRUONG` | `TRUONG_DON_VI` | `PHO_TRUONG_DON_VI` | `GIANG_VIEN_CHUYEN_VIEN` | `VAN_THU` | `LUU_TRU` | `ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `account.manage` | ✗ (Chỉ đạo nhân sự) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Cấp/khóa TK) |
| `org.manage` | ✗ (Ký QĐ thành lập) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Cấu hình ĐV) |
| `position.manage` | ✗ (Phê duyệt đề án) | ✗ (Deny) | ✗ (Đề xuất VTVL) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Quản trị Catalog) |
| `system.configure` | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Cấu hình Server/API) |
| `audit.view` | ✓ (Xem nhật ký toàn trường) | ✓ (Xem nhật ký mảng) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✗ (Deny) | ✓ (Full - Giám sát an ninh) |

---

## 4. KỊCH BẢN TÁC NGHIỆP CỤ THỂ & QUY TRÌNH ĐÁNH GIÁ THỰC TẾ

Dưới đây là 9 kịch bản thực tế mô phỏng chính xác các tương tác hàng ngày tại Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh, làm rõ cơ chế định tuyến và cưỡng chế của hàm `authorize()`.

---

### Kịch bản 1: Hiệu trưởng (ThS. Phạm Văn Tường)
**Bối cảnh**: Hiệu trưởng tiếp nhận Tờ trình xin phê duyệt Kế hoạch Mua sắm Thiết bị Xưởng thực hành Ô tô trị giá 1,5 tỷ đồng từ Phòng Hành chính - Quản trị.
1. **Yêu cầu tác nghiệp**: Hiệu trưởng ghi bút phê chỉ đạo và phê duyệt nhiệm vụ cấp trường (`task.approve`).
2. **Đánh giá thẩm quyền**:
   - `user.position`: `HIEU_TRUONG`
   - `user.portfolio`: `INSTITUTIONAL_STRATEGY` (chủ tài khoản, quản lý tài chính, đầu tư xây dựng cơ bản theo QĐ 420).
   - `task.scope`: `SCHOOL`.
   - `task.createdById`: `usr_truongphong_hcqt` (Khác với ID của Hiệu trưởng -> Thỏa mãn SoD: `Creator != Approver`).
3. **Kết quả đánh giá**: `authorize()` trả về `GRANTED`.
4. **Vết kiểm toán**: Ghi nhận hành động phê duyệt, cập nhật trạng thái nhiệm vụ sang `COMPLETED`, gửi thông báo tức thời đến Phòng Tài chính và Ban Quản trị cơ sở vật chất.

---

### Kịch bản 2: Phó Hiệu trưởng Đào tạo (ThS. Trần Trọng Kiệm)
**Bối cảnh**: Văn thư trình Văn bản số 1254/BGDĐT-GDĐH của Bộ GD&ĐT về việc chuẩn hóa chương trình đào tạo khối ngành Công nghệ thông tin.
1. **Yêu cầu tác nghiệp 2A (Hợp lệ)**: PHT Đào tạo ghi ý kiến bút phê (`document.incoming.direct`), giao Khoa CNTT (`K_CNTT`) chủ trì và Phòng QLĐT (`P_QLDT`) phối hợp, hạn xử lý là ngày 15/10/2026.
   - `user.position`: `PHO_HIEU_TRUONG_DT`.
   - `user.portfolio`: `ACADEMIC` (Phụ trách đào tạo, chương trình giáo dục theo Khoản 4.2 Điều 4 QĐ 420).
   - `doc.category`: Giáo dục chuyên nghiệp & CNTT.
   - `authorize()` xác nhận trùng khớp lĩnh vực -> `GRANTED`. Hệ thống tự động tạo `Task` liên kết giao cho Khoa CNTT.
2. **Yêu cầu tác nghiệp 2B (Trường hợp từ chối - Cross-Portfolio Boundary)**:
   - PHT Đào tạo mở hồ sơ Dự thảo Hợp đồng sửa chữa hệ thống điện nước khu Ký túc xá và cố gắng ký số phê duyệt (`document.outgoing.sign`).
   - `authorize()` kiểm tra thuộc tính: Hợp đồng sửa chữa tài sản thuộc thẩm quyền mảng `ADMINISTRATION_LOGISTICS` của PHT Lê Xuân Nguyên (Khoản 4.3 Điều 4 QĐ 420).
   - `authorize()` trả về: `DENIED` với mã `PORTFOLIO_MISMATCH`. Hệ thống hiển thị cảnh báo: *"Văn bản thuộc lĩnh vực Quản trị - Cơ sở vật chất của Phó Hiệu trưởng Lê Xuân Nguyên. Đồng chí không có thẩm quyền ký số văn bản này trừ khi có giấy ủy quyền điều hành."*

---

### Kịch bản 3: Phó Hiệu trưởng HC-CSVC (ThS. Lê Xuân Nguyên)
**Bối cảnh**: Trình ký Quyết định kiện toàn Đội Phòng cháy chữa cháy cơ sở năm học 2026-2027.
1. **Yêu cầu tác nghiệp**: PHT HC-CSVC thực hiện ký số thay Hiệu trưởng (`document.outgoing.sign` với chức danh `KT. HIỆU TRƯỞNG - PHÓ HIỆU TRƯỞNG`).
2. **Đánh giá thẩm quyền**:
   - `user.position`: `PHO_HIEU_TRUONG_HC`.
   - `user.portfolio`: `ADMINISTRATION_LOGISTICS` (phụ trách an toàn lao động, PCCC theo QĐ 420).
   - Căn cứ ủy quyền thường xuyên tại Khoản 4.3 Điều 4 QĐ 420 cho phép ký thay các văn bản công tác hành chính thông thường.
3. **Kết quả đánh giá**: `authorize()` trả về `GRANTED`.
4. **Cưỡng chế SoD**: Sau khi ký số cá nhân xong, hệ thống khóa toàn bộ các nút chức năng cấp số và đóng dấu đối với tài khoản PHT. Văn bản bắt buộc chuyển về hàng đợi của Văn thư cơ quan.

---

### Kịch bản 4: Trưởng đơn vị (Trưởng phòng QLĐT - TS. Vũ Văn Trực)
**Bối cảnh**: Trưởng phòng nhận nhiệm vụ cấp trường "Xây dựng Lịch thi kết thúc học kỳ I năm học 2026-2027".
1. **Yêu cầu tác nghiệp 4A (Phân rã nhiệm vụ)**: Trưởng phòng tạo nhiệm vụ con (`task.create`) và chỉ định Chuyên viên Nguyễn Văn A làm chủ trì (`task.assign`).
   - `user.position`: `TRUONG_DON_VI`.
   - `target.departmentId`: `P_QLDT`.
   - `authorize()` kiểm tra: Người dùng là Trưởng phòng của đơn vị được giao việc -> `GRANTED`.
2. **Yêu cầu tác nghiệp 4B (Trường hợp từ chối do vi phạm SoD)**:
   - Cuối năm, Trưởng phòng tự lập một nhiệm vụ cá nhân: "Nghiên cứu sáng kiến cải tiến quy trình xếp thời khóa biểu" (`task.createdById === user.id`, `taskAssignee: PRIMARY_OWNER === user.id`).
   - Sau khi hoàn thành báo cáo, Trưởng phòng nộp minh chứng và cố gắng tự bấm nút phê duyệt đạt yêu cầu (`task.approve`).
   - `authorize()` kiểm tra Bước 4 của Pipeline:
     * `resource.createdById === user.id` (Vi phạm quy tắc `Creator != Approver`).
     * `resource.primaryOwnerId === user.id` (Vi phạm quy tắc `Executor != Reviewer`).
   - Kết quả: `DENIED` với mã `SEPARATION_OF_DUTIES_VIOLATION`.
   - Thông báo hệ thống: *"Cán bộ chủ trì không được tự phê duyệt sản phẩm của chính mình. Nhiệm vụ này phải được trình lên Ban Giám hiệu phụ trách đào tạo phê duyệt nghiệm thu."*

---

### Kịch bản 5: Phó Trưởng đơn vị (Phó Trưởng phòng QLĐT nhận ủy quyền DACUM)
**Bối cảnh**: Trưởng phòng đi công tác tại Hà Nội 05 ngày. Trưởng phòng ký văn bản ủy quyền điện tử (`DacumDelegation`) giao Phó Trưởng phòng tạm thời phụ trách duyệt các sản phẩm minh chứng thi đua của phòng.
1. **Yêu cầu tác nghiệp 5A (Duyệt theo ủy quyền hợp lệ)**:
   - Chuyên viên B nộp minh chứng "Tổng hợp điểm thi học kỳ". Phó Trưởng phòng bấm duyệt (`task.approve`).
   - `authorize()` kiểm tra:
     * `now` nằm trong khoảng `startDate` và `expiresAt` của `DacumDelegation`.
     * `delegation.isActive === true`.
     * Cán bộ nộp minh chứng là Chuyên viên B (`uploadedById !== delegate.id`).
   - Kết quả: `GRANTED`. Vết kiểm toán ghi rõ: *"Phê duyệt bởi Phó Trưởng phòng [Tên] theo ủy quyền của Trưởng phòng [Tên] theo Giấy ủy quyền số [documentRef]"*.
2. **Yêu cầu tác nghiệp 5B (Từ chối do tự phê duyệt qua ủy quyền)**:
   - Phó Trưởng phòng cũng có một nhiệm vụ cá nhân: "Soạn thảo đề cương bồi dưỡng nghiệp vụ khảo thí".
   - Phó Trưởng phòng cố gắng dùng quyền ủy quyền của Trưởng phòng để duyệt chính báo cáo của mình.
   - `authorize()` kích hoạt Quy tắc SoD 4: `delegate.id === task.primaryOwnerId`.
   - Kết quả: `DENIED` với mã `SEPARATION_OF_DUTIES_VIOLATION`.

---

### Kịch bản 6: Chuyên viên / Giảng viên (Giảng viên Khoa Du lịch - Dịch vụ)
**Bối cảnh**: Giảng viên thực hiện nhiệm vụ "Cập nhật ngân hàng câu hỏi môn Quản trị Lễ tân".
1. **Yêu cầu tác nghiệp**:
   - Giảng viên cập nhật tiến độ đạt 80% (`task.update_execution`).
   - Giảng viên tải lên tệp zip chứa 200 câu hỏi thi (`task.submit_result`).
2. **Đánh giá thẩm quyền**:
   - `user.position`: `GIANG_VIEN_CHUYEN_VIEN`.
   - Quan hệ: Người dùng là `PRIMARY_OWNER` của nhiệm vụ.
   - Kết quả: `GRANTED` cho các thao tác cập nhật tiến độ và nộp sản phẩm.
3. **Ranh giới bảo mật**: Giảng viên chuyển Scope sang `unit` để xem lịch trình của các giảng viên khác trong bộ môn. Giảng viên bấm thử vào nút chỉnh sửa nhiệm vụ của đồng nghiệp.
   - `authorize()` kiểm tra quan hệ: Người dùng không phải là creator, không phải là owner của nhiệm vụ đó, và không có chức vụ lãnh đạo phòng/khoa.
   - Kết quả: `DENIED` với mã `INSUFFICIENT_RELATIONSHIP`. Giao diện hiển thị ở chế độ Chỉ đọc (Read-only).

---

### Kịch bản 7: Cán bộ Văn thư (Phòng Hành chính - Quản trị)
**Bối cảnh**: Hoàn tất quy trình ban hành Thông báo Lịch nghỉ Tết Nguyên đán của Nhà trường.
1. **Yêu cầu tác nghiệp**:
   - Nhận bản thảo đã có chữ ký số của Hiệu trưởng Phạm Văn Tường.
   - Kiểm tra quy chuẩn thể thức theo Phụ lục I NĐ 30/2020 (`document.outgoing.review_format`).
   - Cấp số công văn đi tự động (`document.outgoing.number`).
   - Áp dụng con dấu điện tử cơ quan (`document.outgoing.organization_sign`).
   - Phát hành công văn qua Trục liên thông và Cổng thông tin (`document.outgoing.issue`).
2. **Đánh giá thẩm quyền**:
   - `user.position`: `VAN_THU`.
   - Căn cứ Điều 18 và Điều 22 NĐ 30/2020: Các năng lực cấp số, đóng dấu pháp nhân và phát hành là đặc quyền chuyên môn của Văn thư cơ quan.
   - Kết quả: `GRANTED` cho toàn bộ chuỗi thao tác này.
3. **Kiểm tra ranh giới SoD**: Văn thư phát hiện lỗi chính tả trong văn bản và cố gắng mở giao diện để sửa lại nội dung văn bản.
   - `authorize()` từ chối: Năng lực `document.outgoing.draft` hoặc sửa nội dung bản thảo đã ký thuộc về đơn vị chủ trì soạn thảo. Văn thư chỉ có quyền yêu cầu đơn vị soạn thảo thu hồi, chỉnh sửa và trình ký lại.

---

### Kịch bản 8: Cán bộ Lưu trữ (Phòng Hành chính - Quản trị)
**Bối cảnh**: Tháng 01 hàng năm, tiếp nhận Hồ sơ công việc nộp lưu từ Khoa Cơ khí theo Kế hoạch lưu trữ số 227/KH-CĐKTCNQN.
1. **Yêu cầu tác nghiệp**:
   - Cán bộ Lưu trữ mở hồ sơ nộp lưu điện tử của Khoa Cơ khí.
   - Kiểm tra tính toàn vẹn danh mục tài liệu, đối chiếu mã băm SHA-256 của từng tệp đính kèm.
   - Xác nhận tiếp nhận hồ sơ vào kho lưu trữ số (`dossier.accept_archive`), thiết lập thời hạn bảo quản 10 năm.
2. **Đánh giá thẩm quyền**:
   - `user.position`: `LUU_TRU`.
   - Kết quả: `GRANTED`. Hồ sơ chuyển sang trạng thái `DA_LUU_TRU_CO_QUAN`, khóa chỉnh sửa vĩnh viễn.
3. **Kiểm tra ranh giới**: Cán bộ Lưu trữ cố gắng thêm một tệp tài liệu mới vào hồ sơ đã đóng (`dossier.add_item`).
   - `authorize()` từ chối: Hồ sơ đã tiếp nhận lưu trữ không được phép thêm bớt tài liệu tùy tiện khi chưa có Quyết định của Hội đồng thẩm định tài li��u cơ quan.

---

### Kịch bản 9: Quản trị viên Hệ thống (Kỹ sư Trung tâm Số - Truyền thông)
**Bối cảnh**: Thực hiện bảo trì hệ thống và hỗ trợ kỹ thuật cho người dùng.
1. **Yêu cầu tác nghiệp 9A (Hợp lệ)**:
   - Tạo tài khoản mới cho cán bộ mới tuyển dụng (`account.manage`).
   - Cấu hình lại địa chỉ Webhook kết nối Telegram Bot (`system.configure`).
   - Kết quả: `GRANTED`.
2. **Yêu cầu tác nghiệp 9B (Trường hợp từ chối tuyệt đối - Separation of Powers Violation)**:
   - Trong đợt nghiệm thu đề tài NCKH, một giảng viên nhờ Quản trị viên can thiệp phê duyệt giúp một báo cáo tiến độ do Trưởng khoa đi vắng chưa kịp duyệt.
   - Quản trị viên đăng nhập tài khoản `admin@cdktcnqn.edu.vn`, gọi API `/api/tasks/task_123/deliverables/deliv_456/approve` (`task.approve`).
   - Hàm `authorize()` chạy đến Bước 3 (Separation of Powers Guard):
     ```typescript
     if (user.role === 'ADMIN' && action === 'task.approve') {
       return {
         granted: false,
         statusCode: 'SEPARATION_OF_POWERS_VIOLATION',
         reason: 'Quản trị viên kỹ thuật không có thẩm quyền ký duyệt hoặc can thiệp nghiệp vụ quản lý của Nhà trường.'
       };
     }
     ```
   - Kết quả: **`403 Forbidden`**. Hệ thống ghi lại cảnh báo an ninh: *"Phát hiện nỗ lực can thiệp nghiệp vụ trái phép từ tài khoản Quản trị viên hệ thống"*.

---

## 5. BẢNG TRA CỨU MÃ TỪ CHỐI ỦY QUYỀN CHUẨN TẮC (AUTHORIZATION REJECTION CODES)

Khi hàm `authorize()` từ chối một yêu cầu tác nghiệp, hệ thống trả về mã lỗi cụ thể kèm thông điệp giải thích rõ ràng để hỗ trợ người dùng và phục vụ kiểm toán:

| Mã phản hồi (Status Code) | HTTP Status | Ý nghĩa pháp lý & Nguyên nhân kỹ thuật | Hành động khắc phục khuyến nghị |
|---|:---:|---|---|
| `UNAUTHENTICATED` | 401 | Phiên làm việc chưa được xác thực hoặc mã thông báo JWT đã hết hạn. | Đăng nhập lại qua Google Workspace SSO Nhà trường. |
| `DEACTIVATED_ACCOUNT` | 403 | Tài khoản đã bị khóa hoặc đánh dấu vô hiệu hóa (`isActive: false`). | Liên hệ Phòng Tổ chức - ĐBCL hoặc Quản trị mạng để kiểm tra trạng thái công tác. |
| `STATE_SECRET_STRICT_PROHIBITION` | 403 | Tài liệu bị phát hiện hoặc đánh dấu là Bí mật Nhà nước theo Luật 117/2025/QH15. | Cấm số hóa; chuyển sang quản lý theo quy trình văn bản mật cơ yếu truyền thống. |
| `PERSONAL_DATA_PRIVACY_BREACH` | 403 | Yêu cầu truy cập dữ liệu cá nhân nhạy cảm vi phạm Luật 91/2025/QH15. | Cung cấp căn cứ pháp lý hoặc thỏa thuận đồng thuận của chủ thể dữ liệu. |
| `SEPARATION_OF_POWERS_VIOLATION` | 403 | Quản trị kỹ thuật (`ADMIN`) cố gắng thực hiện hành động thuộc thẩm quyền điều hành nghiệp vụ. | Quản trị viên không được can thiệp; hành động phải do đúng cán bộ nghiệp vụ thực hiện. |
| `SEPARATION_OF_DUTIES_VIOLATION` | 403 | Vi phạm nguyên tắc phân lập trách nhiệm (Tự duyệt việc mình tạo, tự nghiệm thu sản phẩm mình làm). | Chuyển việc lên cấp quản lý trực tiếp cao hơn để thẩm tra và phê duyệt khách quan. |
| `PORTFOLIO_MISMATCH` | 403 | Lãnh đạo Ban Giám hiệu thực hiện hành vi vượt quá ranh giới mảng phụ trách theo QĐ 420. | Chuyển văn bản cho đúng đồng chí Phó Hiệu trưởng phụ trách lĩnh vực ký duyệt. |
| `DELEGATION_EXPIRED` | 403 | Văn bản ủy quyền (`DacumDelegation`) đã hết thời hạn hiệu lực hoặc đã bị thu hồi. | Gia hạn văn bản ủy quyền hoặc trình Trưởng đơn vị trực tiếp giải quyết. |
| `DEPARTMENT_BOUNDARY_VIOLATION` | 403 | Cán bộ đơn vị này can thiệp vào công việc nội bộ của đơn vị khác khi không được phân công phối hợp. | Chỉ thao tác trong phạm vi phòng ban công tác hoặc chờ quyết định phân công phối hợp. |
| `INSUFFICIENT_RELATIONSHIP` | 403 | Người dùng không giữ quan hệ trực tiếp (chủ trì, phối hợp, giám sát) với thực thể tác nghiệp. | Yêu cầu người tạo việc bổ sung vào danh sách cán bộ phối hợp thực hiện. |
| `INSUFFICIENT_CAPABILITY` | 403 | Vị trí chức danh của người dùng không sở hữu năng lực nghiệp vụ yêu cầu. | Rà soát phân công nhiệm vụ theo bản mô tả vị trí việc làm. |

---

*Ma trận này là cơ sở bắt buộc để xây dựng các Middleware kiểm tra quyền (`src/middleware.ts`), các Service bảo vệ API (`src/lib/authorization-service.ts`) và quy tắc ẩn/hiện thành phần giao diện (UI Action Guards) trong toàn bộ ứng dụng QCET E-Office.*
