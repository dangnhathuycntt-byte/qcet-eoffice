# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: KIẾN TRÚC PWA OFFLINE, SERVICE WORKER CACHING & BACKGROUND MUTATION QUEUE
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Khắc phục Vấn đề Rớt Mạng trong Khuôn viên Trường (Xưởng Cơ khí, Sân trường, Tầng hầm), Ngăn chặn Rollback Mất Dữ liệu & Thiết kế Hàng đợi Ngo��i tuyến Tự Động (Offline Mutation Queue)

---

## 1. PHÂN TÍCH HIỆN TRẠNG & BỐI CẢNH THỰC TẾ KHUÔN VIÊN QCET

### 1.1. Bối cảnh hạ tầng trường học (Campus Network Challenges)
* Khuôn viên trường QCET bao gồm: Khối nhà Hiệu bộ, Khu giảng đường lý thuyết, Trung tâm Tuyển sinh và đặc biệt là **Khu tổ hợp xưởng thực hành kỹ thuật công nghệ** (Cơ khí, Hàn, Điện - Điện tử công nghiệp, Công nghệ Ô tô).
* Kết cấu xưởng thực hành với khung thép chịu lực và mái tôn dày tạo ra hiện tượng **lồng Faraday cục bộ**, làm suy hao sóng 4G/5G rất mạnh.
* Hệ thống Wi-Fi phân tán tạo ra các **vùng chết (dead zones)** khi cán bộ, giảng viên di chuyển qua sân trường hoặc hành lang giữa các khu nhà.
* Hiện tượng **Lie-Fi (máy báo có sóng nhưng không truyền được gói tin)**: Trình duyệt bị treo từ 30-60 giây chờ timeout mặc định của hệ điều hành, làm đóng băng giao diện người dùng.

### 1.2. Hạn chế cốt lõi trong mã nguồn hiện tại
1. **`public/sw.js` quá sơ sài**:
   - Chỉ precache 4 tài nguyên cơ bản, bỏ quên toàn bộ các JS/CSS chunks của Next.js (`/_next/static/*`).
   - Chặn toàn bộ các API call (`if (url.pathname.startsWith('/api/')) return;`), khiến khi mất mạng trang web lập tức ném lỗi `TypeError: Failed to fetch`.
   - Cơ chế Network-First không có giới hạn thời gian chờ (timeout) dẫn đến bẫy Lie-Fi.
2. **`use-task-mutations.ts` tự hủy hoại trải nghiệm người dùng khi mất mạng**:
   - Khi giảng viên bấm "Duyệt nhanh" hoặc chuyển trạng thái nhiệm vụ tại xưởng, nếu Wi-Fi rớt, khối `catch` lập tức **rollback trạng thái cũ** và xóa sạch thao tác vừa thực hiện.
3. **Thiếu vắng chỉ báo ngoại tuyến (Offline Indicator)**:
   - Ứng dụng không lắng nghe sự kiện `online`/`offline`, không có banner hay pill thông báo cho người dùng biết tình trạng kết nối.

---

## 2. KIẾN TRÚC GIẢI PHÁP HAI TẦNG (TWO-TIER OFFLINE ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            QCET Client Layer (UI)                           │
│  ┌─────────────────────────────────────┐   ┌─────────���───────────────────┐  │
│  │ Floating Network Status Pill        │   │ Optimistic Task Mutations   │  │
│  │ (Online / Offline / Syncing X jobs) │   │ (Immediate UI State Update) │  │
│  └─────────────────────────────────────┘   └──────────────┬──────────────┘  │
└───────────────────────────────────────────────────────────│─────────────────┘
                                                            │
                                     ┌──────────────────────┴─────────────────┐
                                     │ Local Mutation Queue & Storage (IDB)   │
                                     │ - Không Rollback khi rớt mạng          │
                                     │ - Lưu action vào qcet_offline_mutations│
                                     └──────────────────────┬─────────────────┘
                                                            │
                 ┌──────────────────────────────────────────┴─────────────────┐
                 │ Network State Watcher & Auto-Reconciliation Engine         │
                 │ - Lắng nghe sự kiện 'online'                               │
                 │ - Tự động phát lại (replay FIFO) khi mạng phục hồi         │
                 └──────────────────────────────────────────┬─────────────────┘
                                                            │
┌───────────────────────────────────────────────────────────▼─────────────────┐
│                        Service Worker Caching Matrix                        │
│                                                                             │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌───────────────┐  │
│  │ Next.js Static Chunks  │  │ Read-Only APIs         │  │ App Navigation│  │
│  │ (/_next/static/*)      │  │ (/api/dashboard/*)     │  │ (Document)    │  │
│  │ Strategy: Cache-First  │  │ Strategy: Network-First│  │ Strategy:     │  │
│  │ (Bất biến theo hash)   │  │ Timeout 2.5s + Fallback│  │ Timeout 2.5s  │  │
│  └────────────────────────┘  └────────────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. BA TRỤ CỘT TRIỂN KHAI KỸ THUẬT

### Trụ cột 1: Nâng cấp Service Worker thông minh (`public/sw.js`)
* **Assets tĩnh:** Áp dụng **Cache-First**. Các bundle `/_next/static/*` được lưu vĩnh viễn theo hash của bản build.
* **API Đọc dữ liệu (`/api/dashboard/*`):** Áp dụng **Network-First với Timeout 2.5s**. Nếu mạng chập chờn quá 2.5s, tự động trả về bản snapshot gần nhất trong cache kèm header `X-QCET-Offline-Cache: true`.
* **HTML Navigation:** Network-First với fallback về trang chủ lưu cache, đảm bảo không bao giờ thấy màn hình khủng long gãy mạng của trình duyệt.

### Trụ cột 2: Hàng đợi Ngoại tuyến & Triệt tiêu Rollback (`src/lib/offline-sync.ts`)
* Khi thao tác cập nhật gặp lỗi mạng:
  1. Giữ nguyên trạng thái trên giao diện (Optimistic Persistence).
  2. Đưa yêu cầu vào hàng đợi `qcet_offline_mutation_queue_v1`.
  3. Khi có mạng trở lại (`window.addEventListener('online')`), tự động phát lại các mutation theo thứ tự FIFO (First In, First Out).

### Trụ cột 3: Chỉ báo Ngoại tuyến Tinh tế (`src/components/layout/offline-banner.tsx`)
* Không dùng dialog chiếm quyền điều khiển.
* Sử dụng **Floating Capsule Pill** nhỏ gọn góc dưới màn hình:
  - Khi Online: Ẩn hoàn toàn (Zero visual clutter).
  - Khi Offline: Hiển thị biểu tượng `WifiOff` màu hổ phách nhẹ (`amber-50` / `amber-900`): `"Đang ngoại tuyến • 2 thao tác chờ gửi"`.
  - Khi có mạng trở lại: Chuyển sang xanh ngọc nhạt (`sky-50` / `sky-900`) xoay nhẹ icon đồng bộ: `"Đang đồng bộ dữ liệu..."`.

---

## 4. KẾT LUẬN

Giải pháp đảm bảo 100% tính liên tục trong công tác chỉ đạo điều hành và tác nghiệp của giảng viên tại trường QCET: thao tác bấm duyệt, chấm điểm, chuyển trạng thái luôn có hiệu lực ngay lập tức, không bao giờ bị mất dữ liệu khi đi vào khu vực mất sóng.
