# Cẩm Nang Chuyên Sâu: Các Nguyên Tắc Thiết Kế Layout & Kỹ Nghệ UI/UX Đẳng Cấp Thế Giới (World-Class UI/UX & Layout Engineering Manual)

> **Tài liệu chuẩn mực thiết kế và kỹ nghệ giao diện hiện đại (Modern Interface Engineering)**  
> *Được tổng hợp từ nghiên cứu thực nghiệm của Nielsen Norman Group (NN/g), Apple Human Interface Guidelines (HIG), Google Material Design 3 (M3), cùng các chuẩn mực kỹ nghệ giao diện đỉnh cao từ Linear (Linear Method), Stripe (Financial Density & Craft), Vercel (Web Interface Guidelines, Rauno Freiberg's Devouring Details), Raycast, và các tiêu chuẩn CSS / màu sắc thế hệ mới (Container Queries, Subgrid, OKLCH, APCA, WCAG 2.2).*

---

## MỤC LỤC
1. [Triết Lý Cốt Lõi: Từ Giao Diện Thị Giác Đến Kỹ Nghệ Nhận Thức (Cognitive Ergonomics)](#1-triết-lý-cốt-lõi-từ-giao-diện-thị-giác-đến-kỹ-nghệ-nhận-thức)
2. [Các Định Luật Tâm Lý Học Hành Vi & UX Cốt Lõi (UX Laws & Psychological Foundations)](#2-các-định-luật-tâm-lý-học-hành-vi--ux-cốt-lõi)
3. [10 Nguyên Tắc Khả Dụng Của Jakob Nielsen (NN/g Usability Heuristics)](#3-10-nguyên-tắc-khả-dụng-của-jakob-nielsen-nng)
4. [Nguyên Lý Thị Giác Gestalt Trong Thiết Kế Layout Hiện Đại](#4-nguyên-lý-thị-giác-gestalt-trong-thiết-kế-layout-hiện-đại)
5. [Hệ Thống Không Gian & Khung Lưới Toán Học (8pt Grid & Spatial Scale)](#5-hệ-thống-không-gian--khung-lưới-toán-học)
6. [Kỹ Thuật Căn Chỉnh Quang Học vs Căn Chỉnh Toán Học (Optical vs Mathematical Alignment)](#6-kỹ-thuật-căn-chỉnh-quang-học-vs-căn-chỉnh-toán-học)
7. [Kỹ Nghệ Thiết Kế Bảng Dữ Liệu Lớn & Datagrid (Data Table & Complex Grid Engineering)](#7-kỹ-nghệ-thiết-kế-bảng-dữ-liệu-lớn--datagrid)
8. [Kỹ Nghệ Layout CSS Hiện Đại: Container Queries, Subgrid & Intrinsic Sizing](#8-kỹ-nghệ-layout-css-hiện-đại-container-queries-subgrid--intrinsic-sizing)
9. [Công Thái Học Biểu Mẫu Doanh Nghiệp & Kiến Trúc Xác Thực (Enterprise Form Ergonomics & Validation)](#9-công-thái-học-biểu-mẫu-doanh-nghiệp--kiến-trúc-xác-thực)
10. [Chuẩn Mực Craftsmanship, Micro-Transitions & Phản Hồi Đa Giác Quan (Linear, Stripe, Vercel, Raycast)](#10-chuẩn-mực-craftsmanship-micro-transitions--phản-hồi-đa-giác-quan)
11. [Khoa Học Màu Sắc Hiện Đại: Không Gian OKLCH, APCA & Dark Mode Elevation](#11-khoa-học-màu-sắc-hiện-đại-không-gian-oklch-apca--dark-mode-elevation)
12. [Hệ Thống Typography & Kiến Trúc Design Tokens 3 Lớp](#12-hệ-thống-typography--kiến-trúc-design-tokens-3-lớp)
13. [Kỹ Nghệ Giao Diện Kỷ Nguyên AI (AI-Era UI/UX Patterns & Latency Engineering)](#13-kỹ-nghệ-giao-diện-kỷ-nguyên-ai)
14. [Công Thái Học Chuyển Động, Bàn Phím & Khả Năng Ti���p Cận (WCAG 2.2 / WAI-ARIA)](#14-công-thái-học-chuyển-động-bàn-phím--khả-năng-tiếp-cận)
15. [Bảng Kiểm Tra Chất Lượng Toàn Diện (World-Class UI/UX Audit Checklist)](#15-bảng-kiểm-tra-chất-lượng-toàn-diện)

---

## 1. Triết Lý Cốt Lõi: Từ Giao Diện Thị Giác Đến Kỹ Nghệ Nhận Thức

Trong phát triển phần mềm hiện đại, ranh giới giữa một giao diện "bình thường" và một sản phẩm "đẳng cấp thế giới" (world-class) không nằm ở sự trang trí màu mè, mà nằm ở **Cognitive Ergonomics (Công thái học nhận thức)** và **Interaction Engineering (Kỹ nghệ tương tác)**.

```
       ┌─────────────────────────────────────────────────────────┐
       │             TAM GIÁC CHẤT LƯỢNG WORLD-CLASS             │
       └─────────────────────────────────────────────────────────┘
                                    ▲
                                   / \
                                  /   \
                                 /     \
                                /       \
         VISUAL CLARITY        /         \       MECHANICAL SPEED
      (Độ rõ ràng thị giác)   /___________\    (Tốc độ phản hồi tức thì)
                             PREDICTABILITY
                        (Mô hình nhận thức chuẩn)
```

1. **Visual Clarity (Độ rõ ràng thị giác)**: Mọi pixel, đường viền, khoảng trắng (negative space) đều phục vụ mục tiêu hướng dẫn sự chú ý. Giao diện giảm thiểu tối đa "visual noise" (nhiễu thị giác) để nội dung quan trọng nổi bật tự nhiên.
2. **Predictability (Khả năng đoán trước)**: Tôn trọng mô hình tư duy (mental models) sẵn có của người dùng, giúp họ thao tác với phản xạ vô thức mà không tốn năng lượng giải mã giao diện.
3. **Mechanical Speed (Tốc độ phản hồi tức thì)**: "Speed is a feature" (Linear). Tương tác phải phản hồi dưới 100ms; trạng thái chuyển động có chủ đích, liền mạch và xóa bỏ cảm giác chờ đợi mạng thông qua Optimistic UI.

---

## 2. Các Định Luật Tâm Lý Học Hành Vi & UX Cốt Lõi

### 2.1. Jakob’s Law (Định luật Jakob)
> *"Người dùng dành phần lớn thời gian trên các ứng dụng và trang web khác, chứ không phải của bạn."*

* **Bản ch���t**: Người dùng mang toàn bộ thói quen, phản xạ tương tác tích lũy từ các nền tảng phổ biến (Google, Apple, macOS, Windows, GitHub, Linear) sang ứng dụng của bạn.
* **Ứng dụng thực tế**:
  * Đặt các thành phần điều hướng (navigation bar, search bar, avatar menu, nút đóng dialog) ở những vị trí chuẩn mực quen thuộc.
  * Không tái phát minh lại các hành vi tương tác cơ bản (ví dụ: `Esc` để đóng modal, `Enter` để submit, `Cmd/Ctrl + K` để mở thanh lệnh nhanh).
  * Giảm thiểu năng lượng tư duy (cognitive load) phải bỏ ra để học lại cách sử dụng sản phẩm.

### 2.2. Fitts’s Law (Định luật Fitts)
> *"Thời gian cần thiết để di chuyển tới một mục tiêu phụ thuộc vào khoảng cách tới mục tiêu và kích thước của mục tiêu đó."*
> $$\text{MT} = a + b \cdot \log_2 \left( \frac{2D}{W} \right)$$
> *(Trong đó: MT = Movement Time, D = Distance, W = Target Width)*

* **Hệ quả thiết kế**:
  * **Kích thước mục tiêu tối thiểu (Touch / Click Targets)**: Apple HIG quy định tối thiểu **44 × 44 pt**; Google Material 3 quy định **48 × 48 dp**. Dù icon hiển thị chỉ 16px hoặc 20px, bounding box có thể click được (clickable area) phải đạt kích thước tối thiểu này qua padding ẩn.
  * **Tận dụng các cạnh vô hạn (Infinite Edges)**: Góc và viền màn hình (desktop) có kích thước mục tiêu $W = \infty$ vì con trỏ chuột không thể trượt qua rìa màn hình. Đặt thanh công cụ, menu hoặc các thao tác toàn cục dọc theo cạnh màn hình giúp người dùng click nhanh mà không sợ trượt tay (overshooting).
  * **Vị trí ngữ cảnh (Contextual Proximity)**: Các nút hành động liên quan mật thiết đến một đối tượng (ví dụ: nút sửa/xóa dòng trong bảng) phải nằm gần đối tượng đó, thay vì buộc người dùng kéo chuột sang phía đối diện màn hình.

### 2.3. Hick’s Law (Định luật Hick)
> *"Thời gian đưa ra quyết định tăng theo hàm logarit cùng với số lượng và độ phức tạp của các lựa chọn."*
> $$T = b \cdot \log_2(n + 1)$$

* **Ứng dụng thực tế**:
  * **Tiết lộ lũy tiến (Progressive Disclosure)**: Chỉ hiển thị những thông tin và lựa chọn thiết yếu nhất cho bước hiện tại. Các tùy chọn nâng cao chỉ xuất hiện khi người dùng chủ động yêu cầu.
  * **Phân mảnh (Chunking)**: Thay vì một biểu mẫu 30 trường trên một trang, chia nhỏ thành các bước tuần tự (wizard) có trạng thái rõ ràng hoặc nhóm lại thành từng card logic mạch lạc.
  * **Smart Defaults (Giá trị mặc định thông minh)**: Đưa ra lựa chọn mặc định tối ưu nhất cho 80% người dùng, giúp họ hoàn tất thao tác chỉ với một cú nhấp chuột.

### 2.4. Miller’s Law & Cognitive Load Theory (Định luật Miller & Lý thuyết Tải nhận thức)
* Bộ nhớ làm việc ngắn hạn (working memory) của con người chỉ có thể xử lý khoảng **$7 \pm 2$** đơn vị thông tin tại một thời điểm (nghiên cứu hiện đại chỉ ra con số thực tế thường là **$4 \pm 1$** khối phức tạp).
* **Ứng dụng layout**:
  * Tránh "nhồi nhét" thông tin (dashboard bloat). Mỗi widget, mỗi thẻ thống kê (KPI card) phải truyền tải một thông điệp hành động duy nhất.
  * Nhóm các con số dài thành từng cụm dễ nhớ (ví dụ số thẻ tín dụng, mã số định danh, số điện thoại).

### 2.5. Peak-End Rule & Zeigarnik Effect
* **Peak-End Rule (Kahneman)**: Con người đánh giá trải nghiệm tổng thể dựa trên khoảnh khắc cao trào nhất (tích cực hoặc tiêu cực) và khoảnh khắc kết thúc, chứ không phải trung bình cộng của mọi giây phút.
  * *Ứng dụng*: Chăm chút đặc biệt cho màn hình kết thúc quy trình (Thành công/Success State), thông báo xác nhận tinh tế, và giải tỏa tối đa ức chế khi gặp lỗi (Error Recovery thân thiện, có gợi ý hành động khắc phục).
* **Zeigarnik Effect**: Con người có xu hướng ghi nhớ và bồn chồn về những tác vụ chưa hoàn thành hơn là việc đã xong.
  * *Ứng dụng*: Dùng thanh tiến độ (progress bar), checklist nhiệm vụ onboarding hoặc huy hiệu trạng thái (status pill) để kích thích người dùng hoàn thành quy trình công việc.

---

## 3. 10 Nguyên Tắc Khả Dụng Của Jakob Nielsen (NN/g)

| STT | Nguyên Tắc (Heuristic) | Ý Nghĩa Thực Tế Trong Kỹ Nghệ Giao Diện |
| :--- | :--- | :--- |
| **1** | **Visibility of System Status**<br>*(Hiển thị rõ ràng trạng thái hệ thống)* | Luôn thông báo cho người dùng biết điều gì đang xảy ra thông qua phản hồi thị giác kịp thời (loading state, optimistic update, save indicator "Đã lưu bản nháp lúc 14:02"). |
| **2** | **Match between System and Real World**<br>*(Tương đồng với thế giới thực)* | Sử dụng ngôn từ, khái niệm quen thuộc với người dùng mục tiêu thay vì thuật ngữ kỹ thuật nội bộ (ví dụ: dùng "Bàn làm việc", "Lịch công tác" thay vì "Dashboard module", "Event CRON"). |
| **3** | **User Control and Freedom**<br>*(Quyền kiểm soát và tự do cho người dùng)* | Luôn cung cấp "cửa thoát hiểm khẩn cấp" rõ ràng: hỗ trợ Undo (`Cmd+Z`), nút Hủy thao tác, xác nhận trước khi xóa dữ liệu vĩnh viễn, dễ dàng đóng drawer/modal bằng phím `Esc`. |
| **4** | **Consistency and Standards**<br>*(Nhất quán và tuân thủ tiêu chuẩn)* | Duy trì tính đồng bộ về từ vựng, iconography, màu sắc ngữ nghĩa (Đỏ = Nguy hiểm, Xanh = Thành công) và kích thước spacing trên toàn bộ hệ thống sản phẩm. |
| **5** | **Error Prevention**<br>*(Chủ động phòng ngừa sai sót)* | Thiết kế loại trừ khả năng người dùng phạm lỗi: disable nút khi chưa đủ điều kiện, kiểm tra định dạng ngay khi gõ (inline validation), hiển thị hộp thoại xác nhận khi thực hiện tác vụ có tính phá hủy. |
| **6** | **Recognition rather than Recall**<br>*(Nhận diện thay vì hồi tưởng)* | Giảm tải trí nhớ: thông tin cần thiết phải luôn nhìn thấy được hoặc dễ dàng tra cứu. Hiển thị lịch sử tìm kiếm, gợi ý tự động (autocomplete), và label trường nhập liệu rõ ràng. |
| **7** | **Flexibility and Efficiency of Use**<br>*(Linh hoạt và hiệu quả sử dụng)* | Phục vụ cả người dùng mới lẫn chuyên gia: cung cấp phím tắt (accelerators), khả năng tùy biến bộ lọc, chế độ xem bảng gọn (compact view) và xem mở rộng. |
| **8** | **Aesthetic and Minimalist Design**<br>*(Thiết kế thẩm mỹ và tối giản)* | Loại bỏ mọi phần tử thị giác không mang lại giá trị tương tác hoặc thông tin. Tối ưu tỷ lệ **Signal-to-Noise Ratio (Tín hiệu / Nhiễu)**. |
| **9** | **Help Users Recognize, Diagnose, and Recover from Errors**<br>*(Nhận biết, chẩn đoán và khắc phục lỗi)* | Thông báo lỗi phải bằng ngôn ngữ đời thường rõ ràng, chỉ rõ nguyên nhân chính xác và đưa ra giải pháp khắc phục cụ thể ngay tại chỗ. |
| **10**| **Help and Documentation**<br>*(Trợ giúp và tài liệu hướng dẫn)* | Dù hệ thống tốt nhất là hệ thống không cần hướng dẫn, khi cần thiết, tài liệu trợ giúp phải ngắn gọn, dễ tìm kiếm và gắn trực tiếp vào ngữ cảnh thao tác (contextual tooltips, empty state guide). |

---

## 4. Nguyên Lý Thị Giác Gestalt Trong Thiết Kế Layout Hiện Đại

```
[ A1 ] [ A2 ]     [ B1 ] [ B2 ]
[ A3 ] [ A4 ]     [ B3 ] [ B4 ]
 <── Cụm A ──>     <── Cụm B ──>
      Khoảng cách giữa các cụm > Khoảng cách nội bộ
```

### 4.1. Law of Proximity (Nguyên lý Tiệm cận / Độ gần)
* Các phần tử nằm gần nhau sẽ được não bộ nhận định là thuộc cùng một nhóm chức năng hoặc có liên hệ logic.
* **Quy tắc vàng của khoảng cách**:
  $$\text{Khoảng cách giữa hai nhóm khác biệt} \ge 2 \times \text{Khoảng cách giữa các phần tử trong cùng nhóm}$$
* *Ví dụ*: Label của ô nhập liệu phải nằm gần ô nhập liệu hơn là nằm gần phần tử phía trên nó.

### 4.2. Law of Common Region (Vùng bao chung)
* Khi các phần tử được đặt bên trong một đường bao khép kín (border) hoặc trên một bề mặt nền riêng biệt (background surface / card container), chúng ngay lập tức được nhận diện là một thực thể độc lập.
* Sử dụng thẻ (Card), thanh ngăn (Dividers) hoặc màu nền phân cấp (`bg-surface-elevated`) để phân tách các khu vực làm việc mà không cần giải thích bằng lời.

### 4.3. Law of Figure-Ground (Hình & Nền)
* Mắt người phân biệt rõ ràng giữa đối tượng trọng tâm (foreground) và không gian phía sau (background).
* **Kỹ thuật hiện đại**:
  * Phân lớp không gian theo trục Z (Z-axis elevation): Dùng độ bóng tinh tế (diffused shadows: `0 1px 2px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.03)`).
  * Lớp phủ mờ (Backdrop Blur / Frosted Glass / Liquid Glass): Làm mờ nền hậu cảnh khi mở Modal hoặc Navigation Drawer để tập trung 100% sự chú ý vào foreground.

### 4.4. Law of Similarity (Đồng dạng)
* Các phần tử có chung hình dạng, màu sắc, kích thước hoặc font chữ sẽ được hiểu là có cùng trạng thái hoặc cấp độ tương tác.
* *Quy chuẩn*: Tất cả các nút bấm chính (Primary Action) phải đồng nhất về kiểu dáng trên mọi trang; tất cả liên kết có thể click (hyperlink) phải có dấu hiệu nhận biết tương đương.

---

## 5. Hệ Thống Không Gian & Khung Lưới Toán Học

### 5.1. Hệ Lưới 8pt Grid & 4pt Sub-grid (Chuẩn mực Công nghiệp)
Hầu hết các màn hình số hiện nay (Desktop, Retina, Mobile) đều có mật độ điểm ảnh chia hết cho 4 hoặc 8. Áp dụng hệ thống khoảng cách toán học giúp giao diện đạt nhịp điệu thị giác (visual cadence) hoàn hảo:

```
Token Scale       Kích Thước (px)      Ứng Dụng Điển Hình
────────────────────────────────────────────────────────────────────────��────
space-1           4px                  Sub-grid, khoảng cách icon với label
space-2           8px                  Padding nút bấm nhỏ, khoảng cách item danh sách
space-3           12px                 Khoảng cách trường nhập liệu, badge padding
space-4           16px                 Padding thẻ chuẩn (Standard card padding), gap
space-6           24px                 Khoảng cách giữa các component con
space-8           32px                 Khoảng cách giữa các section trong panel
space-12          48px                 Margin giữa các khối lớn, khoảng cách header
space-16          64px                 Khoảng cách phân đoạn màn hình cấp cao
```

* **Nguyên tắc bất di bất dịch**: Triệt tiêu hoàn toàn các giá trị khoảng cách ngẫu nhiên (ví dụ: `13px`, `17px`, `21px`, `29px`). Mọi padding, margin, gap phải là bội số của 4 hoặc 8.

### 5.2. Luồng Quét Mắt Tự Nhiên: F-Shape & Z-Pattern
* **Z-Pattern (Trang nội dung dàn ngang & Landing Page)**: Mắt quét từ góc trên trái $\to$ sang trên phải $\to$ chéo xuống dưới trái $\to$ kết thúc ở góc dưới phải (nơi đặt Call to Action chính).
* **F-Pattern (Bàn làm việc, Dashboard & Danh sách dữ liệu dày đặc)**: Mắt quét ngang dòng tiêu đề đầu tiên, di chuyển xuống một đoạn rồi quét ngang dòng thứ hai ngắn hơn, sau đó quét dọc xuống cạnh trái.
  * *Hệ quả*: Đặt các thông tin nhận diện cốt lõi (ID, Tên công việc, Tiêu đề văn bản) ở mép trái ngoài cùng. Các dữ liệu bổ trợ (ngày tháng, trạng thái, người phối hợp) bố trí dần sang phải.

```
F-LAYOUT DÀNH CHO BÀN LÀM VIỆC / TASK TABLE:
┌───────────────────────────────────────────────────────────────────────┐
│ [Cột Khóa: Tên Công Việc / Văn Bản] ──────> [Trạng thái] ──> [Hạn Xử Lý]│  ← Quét ngang dài
├───────────────────────────────────────────────────────────────────────┤
│ [Công việc #2] ───────────────────────────> [Hoàn thành]               │  ← Quét ngang vừa
├───────────────────────────────────────────────────────────────────────┤
│ [Công việc #3] ────>                                                  │  ← Quét dọc trái
│ [Công việc #4] ────>                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 6. Kỹ Thuật Căn Chỉnh Quang Học vs Căn Chỉnh Toán Học

Một trong những dấu hiệu rõ rệt nhất phân biệt giao diện nghiệp dư và giao diện đẳng cấp thế giới là **Optical Alignment (Căn chỉnh quang học)**.

```
CĂN CHỈNH TOÁN HỌC (LỖI)             CĂN CHỈNH QUANG HỌC (CHUẨN WORLD-CLASS)
┌──────────────────────────┐          ┌──────────────────────────┐
│   [Icon] Play Video      │          │    [Icon] Play Video     │
│   (Tâm hình học ở giữa)  │          │   (Đẩy sang phải 1-2px)  │
│   Mắt cảm giác bị lệch   │          │   Trọng tâm thị giác cân │
└──────────────────────────┘          └──────────────────────────┘
```

1. **Nút Play Icon trong hình tròn**:
   * *Toán học*: Tọa độ trung tâm của hình tam giác đặt ở giữa hình tròn.
   * *Thực tế thị giác*: Khối lượng thị giác của tam giác tập trung về cạnh đáy bên trái, khiến icon trông như bị lệch sang trái. Cần bù quang học (optical offset) bằng cách dịch tam giác sang phải **1–2px**.
2. **Cap-Height Alignment (Căn lề chữ và icon)**:
   * Không dùng `vertical-align: middle` máy móc giữa icon và text vì text có khoảng ascender và descender. Căn chỉnh icon theo chiều cao chữ hoa (cap-height) của font chữ để tạo cảm giác thẳng hàng tự nhiên.
3. **Corner Radius Tương Phục (Nested Border Radii)**:
   * Khi một container bo góc chứa một phần tử con cũng bo góc, nếu dùng chung bán kính cong, góc sẽ bị biến dạng và tạo khe hở kỳ quặc.
   * **Công thức toán học chuẩn**:
     $$R_{\text{trong}} = R_{\text{ngoài}} - \text{Padding}$$
     *(Ví dụ: Card ngoài có radius 16px, padding 8px $\to$ Phần tử bên trong phải có radius đúng bằng $16 - 8 = 8\text{px}$).*

---

## 7. Kỹ Nghệ Thiết Kế Bảng Dữ Liệu Lớn & Datagrid

Bảng dữ liệu (Data Table / Datagrid) là trái tim của các phần mềm năng suất, quản trị công việc và SaaS chuyên nghiệp. Xây dựng một bảng dữ liệu chuẩn world-class đòi hỏi giải quyết triệt để các bài toán sau:

```
CẤU TRÚC PHÂN TẦNG Z-INDEX TRONG DATAGRID:
┌──────────────────────────────────────────────────────────────┐
│ [Ô Góc Giao Nhau: Checkbox / ID] (z-index: 30)  │ STICKY     │
│ Cố định cả 2 chiều: Top = 0, Left = 0          │ HEADER     │
├─────────────────────────────────────────────────┤ (z: 20)    │
│ [Cột Cố Định Đầu Tiên] (z-index: 10)            │ Top = 0    │
│ Left = 0 + Đổ bóng viền phải (shadow seam)     │            │
├─────────────────────────────────────────────────┴────────────┤
│ [Các Ô Dữ Liệu Bình Thường] (z-index: 1)                     │
│ Cuộn tự do theo cả trục X và Y                               │
└──────────────────────────────────────────────────────────────┘
```

### 7.1. Cấu Trúc Semantic Markup vs ARIA Grid
* **Ưu tiên Semantic HTML**: Bắt đầu bằng thẻ native `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>` kèm thuộc tính `scope="col"` và `scope="row"`. Trình đọc màn hình (Screen Readers) tự động hiểu quan hệ hàng-cột mà không cần cấu hình phức tạp.
* **Fallback ARIA Grid**: Chỉ chuyển sang `role="grid"` và `role="row"` khi bảng được ảo hóa hoàn toàn (fully virtualized DOM với TanStack Virtual / react-window) để render hàng nghìn dòng.

### 7.2. Kỹ Thuật Đóng Băng & Xếp Chồng (Sticky Headers & Frozen Columns)
* **Quy tắc z-index 3 tầng bắt buộc**:
  * `th.sticky-header`: `position: sticky; top: 0; z-index: 20;` (nằm trên các ô dữ liệu khi cuộn dọc).
  * `td.sticky-column`: `position: sticky; left: 0; z-index: 10;` (nằm trên các ô dữ liệu khi cuộn ngang).
  * `th.sticky-intersection` (ô giao giữa cột đóng băng và header): `position: sticky; top: 0; left: 0; z-index: 30;` (nằm trên cả header lẫn cột đóng băng).
* **Đường phân tách lớp (Shadow Seam)**: Cột cố định phải có đường đổ bóng nhẹ sang phải (`box-shadow: 4px 0 8px -2px rgba(0,0,0,0.06);`) để báo hiệu thị giác rõ ràng rằng dữ liệu đang cuộn trượt bên dưới.

### 7.3. Trạng Thái Sắp Xếp & Bộ Lọc Đa Chiều (Sorting & Filtering UX)
1. **Chỉ báo sắp xếp vĩnh viễn (Persistent Sort Indicator)**:
   * Tuyệt đối không chỉ hiện icon sắp xếp khi hover chuột. Cột đang sắp xếp phải luôn hiển thị mũi tên chỉ hướng rõ ràng ($\uparrow$ Tăng dần / $\downarrow$ Giảm dần). Cột chưa sắp xếp có thể hiển thị icon trung tính mờ nhạt khi hover.
2. **Nút "Xóa tất cả bộ lọc" (Clear All Filters)**:
   * Khi người dùng áp dụng nhiều bộ lọc (Faceted Filters), bảng bắt buộc phải hiển thị huy hiệu số lượng bộ lọc đang kích hoạt kèm nút "Xóa tất cả" (`Clear all filters`). Tránh tình trạng người dùng phải bấm tắt từng chip hoặc reload trang để reset.
3. **Lưu trạng thái bộ lọc theo phiên (Session State Persistence)**:
   * Lưu trữ trạng thái sắp xếp, tìm kiếm và phân trang vào URL Search Params (ví dụ: `?tab=active&sort=due_date&page=2`) để người dùng có thể chia sẻ liên kết hoặc quay lại trang mà không bị mất ngữ cảnh làm việc.

### 7.4. Sửa Đổi Dữ Liệu Ngay Trên Bảng (Inline Editing vs Side Sheet)
* **Quy tắc phân định**:
  * **Inline Editing (Sửa tại chỗ)**: Dành cho các trường đơn lẻ, độc lập, tần suất thay đổi cao (Đổi trạng thái, gán người thực hiện, cập nhật mức độ ưu tiên). Hiển thị cursor text hoặc viền đứt nét khi hover.
  * **Side Sheet / Modal Drawer**: Dành cho các chỉnh sửa phức tạp, nhiều trường phụ thuộc nhau hoặc có xác thực nghiêm ngặt (Validate nghiệp vụ, tải tệp đính kèm).

---

## 8. Kỹ Nghệ Layout CSS Hiện Đại: Container Queries, Subgrid & Intrinsic Sizing

Responsive Web Design truyền thống phụ thuộc vào Media Queries (`@media`) có một điểm nghẽn kiến trúc lớn: component bị ràng buộc vào kích thước của Viewport. Khi một component được đặt vào Sidebar hẹp hay vùng Main Content rộng, nó không thể tự thích ứng nếu không viết thêm các class biến thể thủ công.

### 8.1. Container Queries: Component-Driven Layout Thực Thụ
* **Bản chất**: Cho phép component tự truy vấn và thay đổi layout theo kích thước của vùng chứa cha (`container-type: inline-size`).
* **Quy tắc an toàn**: Luôn dùng `inline-size` (chiều ngang) thay vì `size` (cả 2 chiều) để ngăn ngừa hiện tượng **Layout Loop** (khi con đổi chiều cao làm cha đổi chiều cao, dẫn tới vòng lặp tính toán vô tận).
* **Container Units**: Sử dụng `cqi` (1% inline-size container) để định cỡ typography và padding tỷ lệ thuận với chính khung bao của nó.

```css
/* Thiết lập container cha */
.task-card-container {
  container-type: inline-size;
  container-name: task-card;
  width: 100%;
}

/* Mặc định: Layout dọc (Vertical / Compact) cho container hẹp (Sidebar / Mobile) */
.task-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 16px;
}

/* Tự thích ứng layout ngang khi vùng chứa >= 480px bất kể màn hình to hay nhỏ */
@container task-card (min-width: 480px) {
  .task-card {
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 20px;
  }
  .task-card__title {
    font-size: clamp(1rem, 2cqi + 0.5rem, 1.25rem);
  }
}
```

### 8.2. CSS Subgrid: Đồng Bộ Hàng Cột Giữa Các Card Liền Kề
* **Vấn đề**: Trong CSS Grid thông thường, mỗi Card con tạo ra một ngữ cảnh định dạng riêng. Tiêu đề card dài ngắn khác nhau làm Header, Body và Footer giữa các card trong cùng một hàng bị lệch nhau (misaligned rows).
* **Giải pháp Subgrid**: Dùng `grid-template-rows: subgrid` để các phần tử con thừa hưởng trực tiếp các track từ Grid cha.

```css
/* Grid cha định nghĩa track dòng lặp lại */
.task-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  grid-auto-rows: auto 1fr auto; /* Track 1: Header, Track 2: Body, Track 3: Footer */
}

/* Card con span qua 3 track dòng và thừa hưởng hệ thống hàng từ cha */
.task-card-item {
  grid-row: span 3;
  display: grid;
  grid-template-rows: subgrid;
  background: var(--surface-card);
  border-radius: 8px;
  padding: 16px;
}
/* Header, Body (1fr), Footer tự động căn thẳng hàng tuyệt đối với các card bên cạnh */
```

### 8.3. Intrinsic Sizing Systems (Định Cỡ Nội Tại)
Thay vì hardcode độ rộng pixel, sử dụng các từ khóa kích thước nội tại để layout tự định hình:
* `min-content`: Thu nhỏ tối đa theo phần tử con dài nhất không thể ngắt dòng. (Ví dụ: Cột Checkbox / Mã số ID trong bảng).
* `max-content`: Mở rộng tối đa theo nội dung trên một dòng duy nhất, không ép xuống dòng. (Ví dụ: Cột Nút bấm Thao tác / Badge trạng thái).
* `fit-content(<limit>)`: Mở rộng theo nội dung tự nhiên nhưng bị chặn trần ở ngưỡng tối đa.
* `clamp(min, preferred, max)`: Tạo sự co giãn mượt mà theo tỷ lệ khung hình mà không cần điểm ngắt media query.

```css
/* Bảng dữ liệu tự thích ứng nội tại không bị vỡ cột */
.admin-data-grid {
  display: grid;
  grid-template-columns: 
    min-content               /* Cột Checkbox: Thu hẹp tối đa */
    minmax(220px, 2fr)        /* Cột Tiêu đề: Co giãn chủ đạo */
    max-content               /* Cột Trạng thái & Hạn xử lý: Giữ nguyên 1 dòng */
    fit-content(180px);       /* Cột Đơn vị thực hiện: Tối đa 180px */
}
```

### 8.4. Tối Ưu Hiệu Năng Render Bảng Danh Sách Lớn (Native Virtualization)
* `aspect-ratio`: Thay thế hoàn toàn "padding hack" cũ, giúp trình duyệt đặt chỗ trước khung hình ảnh/tài liệu đính kèm, triệt tiêu 100% **Cumulative Layout Shift (CLS = 0)**.
* `content-visibility: auto` kết hợp `contain-intrinsic-size`: Cho phép trình duyệt bỏ qua việc tính toán layout và paint đối với các hàng (rows) nằm ngoài viewport màn hình. Giúp trang chứa hàng nghìn dòng văn bản tải nhanh tức thì và mượt mà 60fps mà không cần thư viện ảo hóa cồng kềnh.

```css
.task-row-virtualized {
  content-visibility: auto;
  contain-intrinsic-size: auto 72px; /* Chiều cao ước lượng để giữ thanh cuộn ổn định */
}
```

---

## 9. Công Thái Học Biểu Mẫu Doanh Nghiệp & Kiến Trúc Xác Thực

Biểu mẫu (Forms) là nơi phát sinh nhiều ma sát (friction) và ức chế nhận thức nhất trong các ứng dụng quản lý doanh nghiệp và hành chính.

```
VÒNG ĐỜI TRẠNG THÁI FIELD (STATE MACHINE):
┌────────────────────┐   Focus   ┌────────────────────┐
│ PRISTINE_UNFOCUSED │ ────────> │  PRISTINE_FOCUSED  │ (Đang gõ: KHÔNG báo lỗi)
└────────────────────┘           └────────────────────┘
                                           │ on-blur (nếu sai)
                                           ▼
┌────────────────────┐  Đã sửa   ┌────────────────────┐
│  CORRECTED_VALID   │ <──────── │   DIRTY_INVALID    │ (Hiện lỗi; bật as-you-type)
└────────────────────┘ (Gỡ lỗi)  └────────────────────┘
```

### 9.1. Thời Điểm Xác Thực (Validation Timing): "Reward Early, Punish Late"
* **Punish Late (Phạt trễ)**: Tuyệt đối không bao giờ hiển thị thông báo lỗi khi người dùng vừa gõ ký tự đầu tiên trong một trường còn mới (pristine). Đây là lỗi **Premature Validation** gây ức chế tâm lý nặng nề. Chỉ kích hoạt kiểm tra lỗi sau khi người dùng kết thúc tương tác bằng sự kiện **`on-blur`**.
* **Reward Early (Thưởng sớm)**: Khi một trường đã bị đánh dấu lỗi (`dirty / invalid`), lập tức chuyển sang chế độ lắng nghe **`as-you-type`** (có debounce 300ms nếu cần). Ngay khi người dùng sửa đúng định dạng, thông báo lỗi phải biến mất ngay lập tức mà không bắt họ phải nhấp chuột ra ngoài lần nữa.
* **Xử lý khi Submit form chưa hợp lệ**:
  * **Anti-pattern**: Vô hiệu hóa nút Submit (`disabled button`) khi form chưa hợp lệ. Điều này tạo ra "ngõ cụt" (Dead-end), người dùng không biết vì sao nút bị khóa và vi phạm tiêu chuẩn tiếp cận WAI-ARIA.
  * **Chuẩn mực World-Class**: Nút Submit **luôn ở trạng thái Enabled**. Khi người dùng bấm Submit: ngăn chặn gửi dữ liệu, tự động chạy validate toàn bộ các trường, tự động cuộn màn hình và **focus vào trường lỗi đầu tiên** (`firstInvalidField.focus()`), đồng thời thông báo tổng hợp bằng `aria-live="assertive"`.

### 9.2. Công Thái Học Bố Cục Nhãn & Trường (Field & Label Ergonomics)
* **Top-aligned Labels**: Chuẩn mực vàng cho ứng dụng công việc. Mắt người chỉ cần 1 điểm dừng thị giác (fixation point) để quét từ nhãn xuống ô nhập, tốc độ hoàn thành biểu mẫu nhanh nhất và thích ứng hoàn hảo với di động.
* **Left-aligned Labels**: Tiết kiệm chiều dọc nhưng khiến mắt phải đảo liên tục dạng ziczac giữa nhãn và ô nhập. Chỉ nên dùng cho màn hình Cài đặt (Settings) hoặc bảng nhập liệu số liệu chuyên sâu.
* **Floating Labels (Material)**: Gây khó đọc khi chữ bị thu nhỏ, xung đột với placeholder. Hạn chế sử dụng.
* **In-placeholder Labels**: **Nghiêm cấm trong Enterprise UX**. Khi người dùng bắt đầu gõ, nhãn biến mất hoàn toàn, làm mất khả năng tự rà soát dữ liệu và gây nhầm lẫn nghiêm trọng.
* **Quy tắc Single-Column Layout**: Luôn bố trí biểu mẫu theo một cột thẳng đứng duy nhất. Chỉ gộp nhiều trường trên một hàng khi chúng có mối quan hệ phụ thuộc hiển nhiên: *Họ + Tên*, *Ngày bắt đầu + Ngày kết thúc*, *Số lượng + Đơn vị tính*, *Tỉnh/Thành + Mã bưu chính*.

### 9.3. Lựa Chọn Giữa Stepper Wizard vs Single-Page Scroll
| Đặc Điểm | Stepper Wizard (Biểu mẫu đa bước) | Single-Page Scroll + Sticky Action Bar |
| :--- | :--- | :--- |
| **Ngữ cảnh tối ưu** | Luồng tuần tự phân nhánh, dữ liệu bước sau phụ thuộc trực tiếp vào bước trước (Onboarding, Thiết lập hệ thống ban đầu). | Quản lý công việc, tạo hồ sơ văn bản, biểu mẫu chỉnh sửa dữ liệu (Edit Record). |
| **Tâm lý người dùng** | Giảm áp lực nhận thức ban đầu nhờ chia nhỏ các chặng. | Cung cấp cái nhìn toàn cảnh, cho phép người dùng tự do chỉnh sửa bất kỳ phần nào mà không bị gò bó thứ tự. |
| **Cơ chế lưu** | Lưu tiến độ sau mỗi bước hoàn thành. | Sticky Action Bar cố định dưới đáy màn hình hiển thị trạng thái dữ liệu (Dirty state) kèm nút Lưu / Hủy. |

### 9.4. Tương Tác Bàn Phím Đa Chọn (Multi-Select Tag Input)
1. **Phím Backspace 2 nhịp**: Khi ô input đang rỗng, nhấn `Backspace` lần 1 sẽ chọn (highlight) tag cuối cùng với viền cảnh báo rõ rệt; nhấn `Backspace` lần 2 (hoặc `Delete`) mới thực sự xóa tag đó. Tránh việc xóa nhầm dữ liệu quan trọng khi nhấn phím nhanh.
2. **Di chuyển con trỏ**: Cho phép dùng phím `ArrowLeft` / `ArrowRight` để di chuyển focus giữa các tag đã chọn và ô nhập liệu văn bản.
3. **Fuzzy Search & Highlighting**: Làm nổi bật các ký tự khớp từ khóa bằng thẻ `<mark>`; thuật toán xếp hạng theo thứ tự: *Khớp chính xác > Khớp tiền tố > Khớp ranh giới từ > Khớp chuỗi con liên tiếp > Khớp ký tự rải rác*.

### 9.5. Hiệu Chỉnh Lực Cản Cho Thao Tác Nguy Hiểm (Friction Calibration)
Không phải thao tác xóa nào cũng cần hộp thoại xác nhận. Cần hiệu chỉnh lực cản (friction) tương ứng với mức độ rủi ro:

```
MA TRẬN HIỆU CHỈNH LỰC CẢN (FRICTION CALIBRATION MATRIX):
┌─────────────────┬──────────────────────────┬─────────────────────────────────┐
│ CẤP ĐỘ RỦI RO   │ CƠ CHẾ BẢO VỆ            │ TRƯỜNG HỢP ÁP DỤNG             │
├─────────────────┼──────────────────────────┼─────────────────────────────────┤
│ RỦI RO THẤP     │ Single-Click             │ Lưu trữ (Archive), gỡ nhãn tag, │
│ (Có thể hoàn tác│ + Undo Toast (5-10s)     │ xóa văn bản nháp cá nhân        │
├─────────────────┼──────────────────────────┼─────────────────────────────────┤
│ RỦI RO TRUNG    │ Two-Step Dialog          │ Xóa hồ sơ công việc, hủy phân   │
│ (Khó phục hồi)  │ (Focus mặc định nút Hủy) │ công nhiệm vụ, rút quyền phòng  │
├─────────────────┼──────────────────────────┼─────────────────────────────────┤
│ RỦI RO CAO      │ Type-to-Confirm          │ Xóa cơ sở dữ liệu đơn vị, hủy   │
│ (Không thể cứu) │ (Gõ đúng tên tài nguyên) │ tài khoản tổ chức, Reset hệ thống│
└─────────────────┴──────────────────────────┴─────────────────────────────────┘
```

---

## 10. Chuẩn Mực Craftsmanship, Micro-Transitions & Phản Hồi Đa Giác Quan

### 10.1. Bộ Quy Chuẩn Vi Chuyển Động (Micro-Transition Stack - Linear & Raycast)
Các ứng dụng cao cấp không dùng `transition: all 0.2s ease` vì nó tạo cảm giác máy móc, trì trệ. Chúng xây dựng hệ thống chuyển động bất đối xứng:

1. **Đường cong gia tốc bất đối xứng (Asymmetric Motion Timing)**:
   * **Phần tử xuất hiện (Enter)**: Đến nhanh và hãm phanh êm ái: `cubic-bezier(0.0, 0.0, 0.2, 1.0)`.
   * **Phần tử rời đi (Exit)**: Luôn **rời đi nhanh hơn khi đến** bằng đường cong vút nhanh ra ngoài: `cubic-bezier(0.4, 0.0, 1.0, 1.0)`. Khi người dùng đã đóng một cửa sổ, họ muốn quay lại làm việc ngay lập tức, không muốn chờ đợi xem hiệu ứng mờ dần.
2. **Thời lượng tỷ lệ thuận với quãng đường (Distance-Proportional Duration)**:
   * Đổi màu nền (Hover / Focus): **60ms – 80ms** (dưới 100ms não bộ cảm nhận là phản hồi tức thì của vật thể, không phải chuyển động).
   * Dịch chuyển vi mô (Button active, dropdown): **120ms – 160ms**.
   * Di chuyển tấm lớn (Modal, Drawer): **220ms – 280ms**.
3. **Chỉ animate thuộc tính GPU Compositing**:
   * Tuyệt đối không animate `width`, `height`, `margin`, `top`, `left` (gây layout reflow trên từng khung hình).
   * 100% chuyển động mượt mà dựa trên `transform` (`translate3d`, `scale`) và `opacity`.
4. **Cảm giác cơ học khi nhấn nút (Button Press Sensation)**:
   * Khi người dùng nhấn chuột xuống (`:active`), nút dịch chuyển xuống `translateY(1.5px)`, thu nhỏ nhẹ về `scale(0.97)` và nén bóng đổ lại trong **60ms**. Nhả chuột ra hồi phục trong **120ms**. Tạo cảm giác như nhấn một phím cơ học thực thụ.

### 10.2. Vi Chi Tiết Giao Diện Từ Rauno Freiberg (Vercel)
* **Quy luật thu phóng Modal (Proportional Scale)**: Animate Modal xuất hiện bằng fade opacity kèm scale từ **$0.95 \to 1.0$** (tuyệt đối không scale từ 0 lên 1).
* **Tần suất vs Tính mới lạ (Frequency vs Novelty)**: Menu chuột phải, xóa dòng, dropdown bộ lọc diễn ra tức thì d��ới 120ms. Chỉ dùng hiệu ứng xuất hiện nối tiếp (staggering) cho các khoảnh khắc chào mừng, onboarding lần đầu.
* **Tắt transition khi đổi Theme (Disable Theme Transitions)**: Tạm ngắt toàn bộ CSS transitions trong 1 khung hình khi bấm đổi Light/Dark mode để các màu sắc không bị trôi màu lệch pha gây nhức mắt.
* **Mobile Input Zoom Prevention**: Cỡ chữ ô nhập liệu (`input`, `textarea`) trên thiết bị di động phải đạt tối thiểu **16px** để ngăn chặn iOS Safari tự động phóng to (auto-zoom) làm vỡ layout.

### 10.3. Công Thái Học Âm Thanh & Xúc Giác Vi Tế (Auditory & Tactile Ergonomics)
* **Kỹ thuật xác nhận âm thanh tiềm thức (Subconscious Audio Confirmation)**:
  * Trong các ứng dụng năng suất đỉnh cao (Linear, Superhuman, Apple), một âm thanh cực ngắn (xung âm tần số cao 3ms ở mức âm lượng 3–5%) khi hoàn thành một tác vụ quan trọng (đánh dấu xong việc, gửi văn bản) giúp não bộ nhận biết kết quả nhanh hơn **150ms** so với việc chỉ chờ đợi bằng mắt.
* **Nguyên tắc bất biến của âm thanh UI**:
  * Chỉ dùng âm thanh để củng cố phản hồi thị giác, **không bao giờ lấy âm thanh làm kênh thông báo duy nhất**.
  * Cung cấp tùy chọn bật/tắt âm thanh rõ ràng và tôn trọng trạng thái im lặng của hệ điều hành.

---

## 11. Khoa Học Màu Sắc Hiện Đại: Không Gian OKLCH, APCA & Dark Mode Elevation

### 11.1. Vì Sao HSL & RGB Thất Bại Trong Thiết Kế Hệ Thống
Trong không gian màu HSL truyền thống, giá trị $L = 50\%$ của màu Vàng (Yellow) sáng chói gấp nhiều lần so với $L = 50\%$ của màu Xanh dương (Blue). Điều này khiến việc tự động hóa thang màu (Color Scales) cho Design System gặp lỗi sai lệch độ sáng cảm nhận (Perceptual Brightness).

```
So sánh cảm nhận độ sáng thực tế:
Màu Vàng HSL(60, 100%, 50%)    ──> Độ sáng cảm nhận cực cao (gần như trắng)
Màu Xanh HSL(240, 100%, 50%)   ──> Độ sáng cảm nhận rất tối (gần như đen)
```

**Giải pháp World-Class**: Sử dụng không gian màu **OKLCH** (Björn Ottosson). Trục $L$ (Lightness) trong OKLCH đại diện chính xác cho độ sáng mà mắt người cảm nhận được. Hai màu có cùng $L=0.60$ trong OKLCH sẽ luôn có độ sáng thị giác tương đương nhau bất k�� sắc độ (Hue).

### 11.2. Phân Tầng Độ Cao Trong Dark Mode Bằng Độ Sáng (Lightness Elevation)
Trong Dark Mode, **bóng đổ (Drop Shadows) hoàn toàn mất tác dụng** vì nền đã tối đen. Các hệ thống hàng đầu không dùng bóng đổ để phân biệt các lớp, mà sử dụng **bước nhảy độ sáng (Lightness Steps)** trong OKLCH:

```
TẦNG ĐỘ CAO (ELEVATION) TRONG DARK MODE BẰNG OKLCH:
┌─────────────────────────────────────────────────────────────┐
│ 4. Overlay Surface (Modals, Dropdowns)   oklch(0.22 0.007 H)│  ← Gần mắt nhất (Sáng nhất)
├─────────────────────────────────────────────────────────────┤
│ 3. Elevated Surface (Cards, Panels)      oklch(0.18 0.008 H)│
├─────────────────────────────────────────────────────────────┤
│ 2. Default Surface (Content Canvas)      oklch(0.14 0.010 H)│
├──────────────────────────────────���──────────────────────────┤
│ 1. Background Floor (App Background)     oklch(0.10 0.012 H)│  ← Xa mắt nhất (Tối nhất)
└─────────────────────────────────────────────────────────────┘
```

* **Hiệu chỉnh màu Accent trong Dark Mode**: Màu thương hiệu có độ bão hòa cao dùng đẹp ở Light Mode sẽ gây chói lóa mắt (retina burn / halation) ở Dark Mode.
  * **Công thức hiệu chỉnh**: Tăng Lightness lên **8–12 điểm** và giảm Chroma đi **20–30%** (giữ nguyên Hue).

### 11.3. Tiêu Chuẩn Tương Phản APCA (Accessible Perceptual Contrast Algorithm)
WCAG 2.2 sử dụng công thức toán học đối xứng ($4.5 : 1$), bỏ qua thực tế sinh học rằng mắt người cảm nhận chữ sáng trên nền tối (Dark mode) khác hoàn toàn chữ tối trên nền sáng (Light mode).

Chuẩn **APCA** (nền tảng của dự thảo WCAG 3.0) tính toán giá trị độ tương phản $L_c$ có tính đến chiều phân cực (Polarity), kích thước font và độ đậm:
* **Body text (Đọc trôi chảy)**: Tối thiểu $|L_c| \ge 75$ (tương đương 4.5:1 của WCAG).
* **Văn bản lớn & Thành phần tương tác (Buttons, Inputs)**: Tối thiểu $|L_c| \ge 60$.
* **Đường viền, Focus ring, Icon phụ**: Tối thiểu $|L_c| \ge 45$.

---

## 12. Hệ Thống Typography & Kiến Trúc Design Tokens 3 Lớp

### 12.1. Thang Tỉ Lệ Chữ (Modular Type Scale)
Giao diện ứng dụng làm việc chuyên nghiệp (SaaS / Enterprise) nên sử dụng thang tỉ lệ **Major Second (1.125)** hoặc **Minor Third (1.200)** với font cơ sở $14\text{px}$ hoặc $16\text{px}$:

```
Cấp Độ              Kích Thước     Line Height    Weight         Mục Đích Sử Dụng
─────────────────────────────────────────────────────────────────────────────────
Caption / Label     12px           16px (133%)    Medium (500)   Badge, timestamp, metadata
Body Small          13px           18px (138%)    Regular (400)  Dữ liệu bảng dày đặc, chú thích
Body Base           14px           20px (142%)    Regular (400)  Nội dung chính, input text
Body Large          16px           24px (150%)    Medium (500)   Lead paragraph, item card header
Heading 3           18px           24px (133%)    SemiBold (600) Tiêu đề thẻ, dialog title
Heading 2           20px           28px (140%)    SemiBold (600) Tiêu đề phân hệ / section
Heading 1           24px           32px (133%)    Bold (700)     Tiêu đề trang (Page Title)
Display / Hero      30-36px        38-44px        Bold (700)     Thống kê nổi bật, số liệu KPI lớn
```

* **Quy tắc Line-Height**: Kích thước chữ càng lớn thì line-height càng phải thu hẹp lại (Heading: 115%–130%; Body text: 140%–160% để đảm bảo khả năng đọc liên tục).

### 12.2. Kiến Trúc Design Tokens 3 Lớp (Semantic Token Architecture)
Không bao giờ hardcode mã màu hex (`#1e293b`) trong mã nguồn thành phần giao diện. Sử dụng hệ thống token 3 lớp:

```
[1. Global Raw Token]      ──>   [2. Semantic Token]          ──>   [3. Component Token]
(Màu thô thực tế)               (Ý nghĩa ngữ cảnh)                 (Áp dụng cụ thể)
--blue-600: #2563eb       ──>   --brand-primary: var(...)     ──>   --btn-primary-bg
--slate-50: #f8fafc       ──>   --surface-page: var(...)      ──>   --table-header-bg
--red-500: #ef4444        ──>   --feedback-danger: var(...)   ──>   --input-border-error
```

---

## 13. Kỹ Nghệ Giao Diện Kỷ Nguyên AI (AI-Era UI/UX Patterns)

Khi các tác nhân trí tuệ nhân tạo (AI Agents) và mô hình ngôn ngữ lớn (LLM) được tích hợp trực tiếp vào phần mềm doanh nghiệp, trải nghiệm người dùng đối mặt với độ trễ cố hữu của mạng và tính bất định (non-deterministic). Các sản phẩm hàng đầu áp dụng 5 nguyên tắc kỹ nghệ sau:

```
QUY TRÌNH HIỂN THỊ STREAMING TRONG SUỐT:
┌────────────────────────────────────────────────────────────────────────┐
│ [Nút Dừng (Stop / Cancel)] Luôn hiển thị ngay từ token đầu tiên         │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ Quá trình suy luận (Reasoning Trace - Đã hoàn thành trong 1.8s)      │
│   • Đã tìm kiếm 5 hồ sơ công việc liên quan                            │
│   • Đã đối chiếu tiến độ các ban chuyên môn                            │
├────────────────────────────────────────────────────────────────────────┤
│ Đang soạn thảo văn bản phản hồi... [Con trỏ nhấp nháy êm ái]           │
│ (Nhịp độ render được điều tiết mượt mà 40-60 token/giây)              │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Designing for Latency & Streaming Cadence**:
   * Tiêu chí tối thượng là **Time-to-First-Token (TTFT < 500ms)**. Người dùng có thể bắt đầu đọc ngay khi token đầu tiên xuất hiện.
   * **Điều tiết nhịp độ (Token Smoothing)**: Không xả ồ ạt token theo biến động giật cục của mạng (network jitter). Ứng dụng client cần đệm nhẹ (buffer) để nhả chữ với tốc độ đọc tự nhiên của mắt người (**30–70 tokens/giây**).
2. **Khai Tử "Black Box Spinner" (Xóa bỏ vòng xoay vô định)**:
   * Vòng xoay spinner không kèm thông tin tiến độ khiến người dùng cảm giác hệ thống bị đơ và rời bỏ màn hình.
   * Thay thế bằng: **Streaming text**, **Skeleton định hình trước khung bố cục**, hoặc **Dòng trạng thái hành động c��� thể** (*"Đang trích xuất nội dung văn bản..."*).
3. **Bảng Điều Khiển Không Chặn (Non-blocking Side Panel vs Modal Hostage)**:
   * Tuyệt đối không nhốt người dùng trong một Modal Dialog đóng băng màn hình trong khi AI đang xử lý tác vụ kéo dài 10–20 giây.
   * Đưa tác vụ AI vào Side Sheet hoặc thanh tác vụ nền, cho phép người dùng tiếp tục tra cứu, duyệt bảng và làm việc trên giao diện chính.
4. **Quyền Dừng Khẩn Cấp (Instant Stop Affordance)**:
   * Nút **Dừng (Stop / Abort)** phải xuất hiện nổi bật ngay từ khi token đầu tiên được tạo. Nếu người dùng nhận thấy mô hình đang đi sai hướng, họ phải có quyền ngắt ngay lập tức chỉ với 1 cú click hoặc phím `Esc`.
5. **Human-in-the-Loop & Phê Duyệt Trực Quan (Inline Diffs & Review Gates)**:
   * Mọi sửa đổi dữ liệu do AI đề xuất phải được hiển thị dưới dạng **Inline Diff trực quan** (Thêm màu xanh, Xóa gạch đỏ) kèm 2 nút xác nhận rõ ràng: `Chấp thuận [Cmd + Enter]` hoặc `Từ chối [Esc]`.

---

## 14. Công Thái Học Chuyển Động, Bàn Phím & Khả Năng Tiếp Cận

### 14.1. Tiêu Chuẩn WCAG 2.2 & Khả Năng Tiếp Cận Toàn Diện
* **Độ tương phản văn bản chuẩn (WCAG Level AA)**:
  * Văn bản thông thường: Tỷ lệ tương phản tối thiểu **4.5 : 1** so với nền.
  * Văn bản lớn (từ 18px đậm hoặc 24px thường): Tỷ lệ tối thiểu **3.0 : 1**.
  * Các thành phần giao diện và viền input đang active: Tỷ lệ tối thiểu **3.0 : 1**.
* **Tránh bẫy màu sắc (Color-alone cue)**: Tuyệt đối không dùng duy nhất màu sắc để chỉ thị trạng thái lỗi hoặc thành công. Luôn kết hợp kèm icon hoặc văn bản giải thích đi kèm để hỗ trợ người dùng khiếm thị màu (Color blindness).

### 14.2. Tiêu Chuẩn Điều Hướng Bàn Phím Hoàn Hảo (Keyboard Operability)
1. **Trình tự Tab hợp lý (`tabindex`)**: Di chuyển tuần tự theo luồng đọc từ trái sang phải, từ trên xuống dưới. Không đặt `tabindex > 0`.
2. **Focus Trap trong Hộp thoại (Modal Focus Trap)**: Khi mở một modal hoặc dialog, con trỏ phím `Tab` phải bị khóa bên trong modal đó, không được lọt ra ngoài hậu cảnh. Khi đóng dialog, trả focus về đúng phần tử đã kích hoạt nó ban đầu.
3. **Phím tắt toàn cục có chú thích trực quan**: Hiển thị tooltip kèm phím tắt (ví dụ: `Lưu văn bản [Ctrl + S]`) để đào tạo người dùng nâng cao kỹ năng sử dụng theo thời gian.

### 14.3. Công Thái Học Chuyển Động (Micro-Motion Guidelines)
* **Thời lượng lý tưởng**: **150ms – 250ms** cho micro-interactions (hover, click, active toggle); **250ms – 350ms** cho chuyển cảnh cấu trúc lớn (drawer trượt, modal mở).
* **Đường cong gia tốc (Easing Curves)**:
  * Tránh dùng `linear` máy móc.
  * Xuất hiện (Enter): `cubic-bezier(0, 0, 0.2, 1)` (Decelerate curve - vào nhanh, hãm phanh êm).
  * Ẩn đi (Exit): `cubic-bezier(0.4, 0, 1, 1)` (Accelerate curve - bắt đầu chậm, vút nhanh ra ngoài).
* **Tôn trọng tùy chọn hệ thống**: Luôn khai báo `@media (prefers-reduced-motion: reduce)` để tắt các hiệu ứng chuyển động lớn đối với người dùng mắc hội chứng tiền đình hoặc nhạy cảm thị giác.

---

## 15. Bảng Kiểm Tra Chất Lượng Toàn Diện (World-Class UI/UX Audit Checklist)

Dùng checklist này để kiểm định mọi màn hình, tính năng trước khi đưa vào sản xuất:

### A. Bố Cục & Không Gian (Layout & Spatial Hierarchy)
- [ ] **Lưới 8pt đồng bộ**: Toàn bộ padding, margin, gap đều thuộc thang đo 4px / 8px / 12px / 16px / 24px / 32px. Không còn pixel lẻ ngẫu nhiên.
- [ ] **Khoảng cách phân cấp rõ rệt**: Khoảng cách giữa các khối khác biệt lớn gấp đôi khoảng cách giữa các phần tử nội bộ (Gestalt Proximity).
- [ ] **Cân chỉnh quang học chính xác**: Các icon dạng tam giác/mũi tên, badge tròn, avatar đã được bù trừ quang học để không bị cảm giác lệch tâm.
- [ ] **Bo góc đồng tâm**: Bán kính bo góc ngoài và trong tuân thủ đúng công thức $R_{\text{trong}} = R_{\text{ngoài}} - \text{Padding}$.
- [ ] **Container Queries & Subgrid**: Tận dụng `@container` để card tự thích ứng linh hoạt và `subgrid` để căn thẳng hàng các hàng nội bộ giữa các card cạnh nhau.
- [ ] **Đáp ứng linh hoạt (Responsive Robustness)**: Giao diện co giãn mượt mà từ màn hình nhỏ (390px mobile) đến màn hình cực rộng (1920px+ desktop), không phát sinh thanh cuộn ngang ngoài ý muốn (`overflow-x: hidden`).

### B. Kiểu Chữ & Màu Sắc (Typography & Color Balance)
- [ ] **Thang đo chữ có kiểm soát**: Tối đa 4–5 cỡ chữ trên một màn hình làm việc; line-height tỉ lệ nghịch với cỡ chữ để tối ưu nhịp đọc.
- [ ] **Độ tương phản WCAG 2.2 & APCA**: Mọi nhãn chữ đều vượt qua tỷ lệ 4.5:1 ở Light Mode và không bị chói lóa (halo/bloom) ở Dark Mode.
- [ ] **Phân t��ng Dark Mode bằng Lightness**: Không dựa vào bóng đổ ở Dark Mode; các tầng card, panel, modal có bước nhảy độ sáng tăng dần (`oklch`).
- [ ] **Kiểm soát mật độ tín hiệu (Signal-to-Noise)**: Chỉ có duy nhất 1 nút Primary Action trên mỗi vùng làm việc chính; các nút còn lại là Secondary hoặc Ghost.
- [ ] **Không hardcode màu sắc**: 100% màu sắc sử dụng semantic design tokens, sẵn sàng cho việc mở rộng theme hoặc thương hiệu.

### C. Bảng Dữ Liệu & Biểu Mẫu (Datagrid & Form Ergonomics)
- [ ] **Xếp chồng z-index chuẩn**: Cột cố định (z: 10), Header cố định (z: 20) và Ô giao nhau góc (z: 30) cuộn mượt mà không bị đè chữ lên nhau.
- [ ] **Chỉ báo sắp xếp thường trực**: Cột được sắp xếp luôn hiển thị chiều mũi tên, không ẩn đi khi bỏ chuột ra.
- [ ] **Đường dẫn xóa bộ lọc nhanh**: Có nút "Xóa tất cả bộ lọc" kèm huy hiệu hiển thị số bộ lọc đang áp dụng.
- [ ] **Xác thực biểu mẫu "Reward early, punish late"**: Không báo lỗi khi người dùng đang gõ lần đầu; chỉ báo lỗi khi blur; gỡ lỗi ngay lập tức khi đang sửa.
- [ ] **Nút Submit luôn Actionable**: Không dùng disabled button khi form chưa hợp lệ; kích hoạt validate toàn bộ và autofocus vào trường lỗi đầu tiên.
- [ ] **Hiệu chỉnh lực cản thao tác nguy hiểm**: Áp dụng Single-click + Undo Toast cho xóa an toàn; Two-step Dialog cho rủi ro trung bình; Type-to-confirm cho cấp hệ thống.

### D. Tương Tác & Tốc Độ (Interaction & Performance)
- [ ] **Vùng chạm an toàn**: Mọi nút bấm, icon thao tác đều có clickable area tối thiểu 44×44px.
- [ ] **Phản hồi tức thì (<100ms)**: Có hover state, active state rõ rệt; hỗ trợ Optimistic UI đối với các tác vụ thường nhật.
- [ ] **Không nhấp nháy giao diện (Zero Flicker Loading)**: Áp dụng delay 150ms trước khi hiển thị skeleton; không để layout shift (CLS = 0) khi dữ liệu về.
- [ ] **Animate scale tinh tế**: Modal scale từ 0.95 đến 1.0 (không dùng 0 đến 1); nút bấm nhấn scale về 0.96-0.98.
- [ ] **Tắt transition khi đổi Theme**: Không để màu sắc nhấp nháy khi bấm đổi giao diện Sáng/Tối.
- [ ] **Trải nghiệm AI minh bạch**: Hỗ trợ streaming mượt mà (30-70 token/s), có nút Dừng ngay từ token đầu, hiển thị bước suy luận (reasoning trace) và xem trước khác biệt (inline diff).

---
*Tài liệu được thiết lập làm chuẩn mực quy chiếu thiết kế và kỹ nghệ phát triển giao diện của hệ thống.*
