# Token thiết kế của Linear và đối chiếu QCET

Đo ngày 22/10/2026. Tài liệu này ghi **số đo cụ thể** (màu, chữ, bo góc, khoảng cách, bóng, chuyển động, trạng thái). Nguyên tắc đằng sau các số đo nằm ở [LINEAR_ASANA_UI_UX_PRINCIPLES.md](LINEAR_ASANA_UI_UX_PRINCIPLES.md).

Trạng thái: **số đo chuẩn để đối chiếu** cho quy tắc UI/UX ở [AGENTS.md](../../AGENTS.md) (duyệt 22/10/2026). Mục 1–7 là số của Linear, không tự thành giá trị QCET: giá trị QCET đang dùng nằm ở [DESIGN.md](../../DESIGN.md) và `globals.css`, thắng khi khác; các điểm cố ý không theo Linear là nhóm Giữ ở mục 8.2. Đề xuất ở mục 8 đã được người dùng duyệt ngày 22/10/2026 ("đồng ý làm toàn bộ") và áp dụng trên nhánh `feat/linear-tokens`, trừ nhóm Giữ; kết quả ở mục 8.4. Quyết định đã duyệt của QCET ở [AGENTS.md](../../AGENTS.md) và [DESIGN.md](../../DESIGN.md) vẫn được ưu tiên.

## 0. Nguồn và cách đo

Mỗi bảng ghi một trong ba mức nguồn. Khi A khác B/C, **lấy B/C cho giao diện ứng dụng**.

| Mức | Nguồn | Ghi chú |
|---|---|---|
| **A. Website** | CSS của trang marketing `linear.app` (`static.linear.app/web/...`) | Là website, không phải app. Có đủ ba theme `dark`, `light`, `glass` bằng hex. |
| **B. Bundle app** | CSS và JS của app web (`static.linear.app/client/...`), CSS khung khởi động trong trang `/login` | Token gốc của app: cỡ chữ, weight, tốc độ, input theme (LCH), preset. Màu app được JS sinh lúc chạy, không nằm trong CSS. |
| **C. DOM thật** | App đã đăng nhập, theme **Light mặc định**, viewport 1800×948 CSS px, macOS | Đo bằng `getComputedStyle`/`getBoundingClientRect`/`elementFromPoint` trên sidebar, danh sách issue mẫu, menu chuột phải, Cmd+K, hộp tạo issue, tooltip, trang chi tiết. Chỉ mở/đóng, không tạo hay sửa dữ liệu. |

Quy đổi màu: CSS `lch()` dùng Lab D50 → sRGB. Kiểm khớp 5 điểm với hex Linear tự ghi trong CSS khung khởi động: `#f9f9fa`, `#efeff0`, `#e2e2e2`, `#121213`, `#5e6ad2`.

---

## 1. Màu

### 1.1. Linear sinh màu thế nào (B)

- Mỗi theme chỉ có **3 đầu vào**: `base` (LCH), `accent` (LCH), `contrast` (0–100). Schema hiện có thêm `sidebarInput` tùy chọn (base/accent/contrast riêng cho sidebar). Schema trong bundle là `{base, accent, contrast: 0..100, sidebarInput?}`.
- **Preset có sẵn** (input LCH, làm tròn):

| Theme | base `[L, C, H]` | accent `[L, C, H]` | contrast |
|---|---|---|---|
| Light (mặc định) | `[97.94, 0.5, 282]` | `[53, 52.26, 286.91]` (≈ `#6d78d5`) | 30 |
| Dark (mặc định) | `[5.52, 0.4, 272]` (≈ `#121213`) | `[47.92, 59.30, 288.42]` (≈ `#5e6ad2`) | 27 |
| Light, tương phản cao | `[98.7, 0.5, 282.86]` | như Light | 90 |
| Dark, tương phản cao | `[8, 0.75, 272]` | như Dark | 90 |
| Classic dark | `#1F2023` | `#5E6AD2` | 30 |
| Magic Blue | `[9.47, 6.57, 282.86]` (≈ `#191a23`) | `[42.89, 62.45, 291.57]` | 30 |

  Ngoài ra còn các preset `pureLight`, `ash`, `dawn`, `midnight`, `pale`, `harlequin`.
- **Tự bật theme tương phản cao** khi trình duyệt báo `prefers-contrast: more`, hoặc khi hệ điều hành bật tương phản cao (bản desktop). App cũng đọc cờ "Differentiate without color" của macOS.
- Đổi theme được bọc trong **View Transition API** (`startViewTransition`) để chuyển mượt.
- **Tên vai trò màu** trong code: `bgBase`, `bgSub`, `bgShade`, `bgBorder`, `bgBorderSolid`; `labelTitle`, `labelBase`, `labelMuted`, `labelFaint`; `controlPrimary`; màu theo sắc `{blue, green, purple, orange, red, teal, yellow}` × `{Mid, Bg, Foreground}`. Biến CSS app dùng `--color-bg-*`, `--color-text-*`, `--color-border-*`.

### 1.2. Bậc sáng của theme Light (C)

Đây là phần dùng lại được: **bậc chênh độ sáng L** giữa các vai trò, với `base` L97.94, `contrast` 30. Chroma gần 0 (0–1.25), hue 282: xám trung tính, chỉ hơi lạnh một chút.

| Vai trò | LCH | Hex | Dùng ở đâu |
|---|---|---|---|
| Nền nội dung (`--color-bg-primary`) | L97.94 C0.5 | `#f9f9fa` | Khung nội dung chính, header |
| Nền canvas/sidebar (`bg-quaternary`, `--bg-sidebar-color`) | L94.44 C0.5 | `#efeff0` | Sidebar, nền quanh khung nội dung; nền hàng nhóm; nền rê chuột hàng |
| `bg-secondary` / `bg-tertiary` | L92.44 / L90.94 | `#e9e9ea` / `#e5e5e6` | Lớp nền sâu hơn |
| Mục sidebar đang chọn | L89.54 C0.5 | `#e1e1e2` | Nền hàng sidebar active |
| Chip view đang chọn | L93.48 C0.5 | `#ececed` | "All issues" đang chọn |
| Popover, menu, hộp thoại, tooltip | L100 | `#ffffff` | Mọi lớp nổi |
| Tô sáng mục menu | L95 C0 | `#f1f1f1` | Mục đang focus/rê chuột |
| Viền hairline lớp nổi | L91.9 C0 | `#e8e8e8` | Viền 0.5px của menu, Cmd+K, hộp thoại, tooltip, keycap |
| Viền khung nội dung | L89.84 C0 | `#e2e2e2` | Viền 0.5px quanh khung nội dung |
| `border-primary` / `secondary` / `tertiary` | L95.24 / L88.49 / L84.44 | `#f1f1f1` / `#dedede` / `#d3d3d3` | Đường chia các mức |
| Chữ chính (`text-primary`) | L9.79 C0 | `#1b1b1b` | Tiêu đề, tên issue |
| Chữ phụ 1 (`text-secondary`) | L19.59 C1.25 | `#2f2f31` | Thân mô tả, breadcrumb, chữ trong menu (L20) |
| Chữ phụ 2 (`text-tertiary`) | L39.18 C1.25 | `#5c5c5e` | Mã issue, ngày, nhãn nhóm thuộc tính, chữ chip/nút phụ, gợi ý phím tắt (L40) |
| Chữ sidebar | L37.78 C1.25 | `#59595b` | Mục sidebar chưa chọn (nhạt hơn chữ chính, đúng ý "sidebar lùi lại") |
| Chữ mờ (`text-quaternary`) | L64.64 C1.25 | `#9c9d9f` | Placeholder, disabled |
| Thanh cuộn | L64.94 C1.25 | `#9d9ea0` (xấp xỉ) | Thumb |
| Accent | L53 C52.26 H286.91 | `#6d78d5` | Nút chính, viền focus, vùng chọn |
| Chữ trên accent | L100 C5 | `#fffeff` | Chữ nút chính |
| Lớp phủ sau hộp thoại | đen 25% | `rgb(0 0 0 / 0.25)` | Hộp tạo issue; Cmd+K không có lớp phủ |

Nhận xét:

- **4 mức chữ** cách nhau gần như nhân đôi theo L (9.8 → 19.6 → 39.2 → 64.6).
- **4 mức nền** chỉ chênh 1.5–3.5 L mỗi bậc.
- **Trạng thái chọn dùng xám, không dùng màu accent.** Accent chỉ xuất hiện ở nút chính, viền focus và vùng chọn chữ.

### 1.3. Theme Dark (chỉ B, chưa đo trên DOM)

Theo CSS khung khởi động, dark mặc định có: sidebar `#09090a`, nền `#121213`, viền `#212224`, chữ placeholder `#6b6f76`, accent `#5e6ad2` (màu thương hiệu indigo).

Light tương ứng: sidebar `#efeff0`, nền `#f9f9fa`, viền `#e2e2e2`, `meta theme-color` `#EFEFF0`.

### 1.4. Màu tín hiệu và màu nhãn (A)

Bảng màu website: đỏ `#eb5757`, cam `#fc7840`, vàng `#f0bf00`, xanh lá `#27a644`, xanh dương `#4ea7fc` (bản P3 `color(display-p3 .431 .6816 .9988)`), teal `#00b8cc`, indigo `#5e6ad2`.

App không dùng hex cố định mà sinh từng sắc theo theme (`{hue}Mid/Bg/Foreground`, mục 1.1).

### 1.5. Bộ token website (A, tham khảo)

| Token | Dark | Light |
|---|---|---|
| `--color-bg-level-0..3` | `#08090a` `#0f1011` `#141516` `#191a1b` | `#fff` `#f8f8f8` `#f4f4f4` `#f0f0f0` |
| `--color-text-primary/secondary/tertiary/quaternary` | `#f7f8f8` `#d0d6e0` `#8a8f98` `#62666d` | `#282a30` `#3c4149` `#6f6e77` `#86848d` |
| `--color-border-primary/secondary/tertiary` | `#23252a` `#34343a` `#3e3e44` | `#e9e8ea` `#e4e2e4` `#dcdbdd` |
| `--color-border-translucent(-strong)` | `#ffffff0d` / `#ffffff14` | `#0000000d` / `#00000014` |
| `--color-accent` / `hover` / `tint` | `#7170ff` / `#828fff` / `#18182f` | `#7170ff` / `#8989f0` / `#f1f1ff` |
| `--color-overlay-primary` | `#000000d9` | `#ffffffa6` |
| Vùng chọn | `color-mix(in lch, brand, black 10%)` | `color-mix(in lch, brand, transparent 64%)` |

---

## 2. Chữ

### 2.1. Font và thang cỡ (B)

- **Font**: `"Inter Variable", "SF Pro Display", -apple-system, …`; mono `"Berkeley Mono", …`.
  - Website (A) thêm `font-feature-settings: "cv01", "ss03"` và `font-variation-settings: "opsz" auto`. Inter 4 có trục optical size nên cỡ lớn tự chuyển sang dáng Display.
  - Serif hiển thị của website: `"Tiempos Headline"`.
- **Thang cỡ của app**:

| Tên | Cỡ |
|---|---|
| `micro` | 11px |
| `mini` | 12px |
| `small` | 13px |
| `regular` | 15px |
| `large` | 18px |
| `title3` | 20px |
| `title2` | 24px |
| `title1` | 36px |

- **Weight của app**: normal **450**, medium 500, semibold 600, bold 700. Website (A) dùng 400/510/590/680; khi làm app, lấy số của app.
- **Editor** (B):
  - Thân 15px, line-height 1.6, letter-spacing `-0.0067em`.
  - H1 22px/29.6px, H2 19px/28px, H3 17px/24px.
  - Khoảng giữa khối 16px (nhỏ 6px, lớn 22px); thụt danh sách 24px.
  - Tay kéo khối 20px; bo khối 6px.

### 2.2. Cỡ chữ từng chỗ trên app (C)

| Chỗ | Cỡ / weight | Màu | Ghi chú |
|---|---|---|---|
| Mục sidebar | 13 / 500 | chữ sidebar `#59595b` | Mục đang chọn: chữ `#1b1b1b` |
| Nhãn nhóm sidebar ("Workspace", "Your teams") | 12 / 500 | `#59595b` | |
| Breadcrumb header | 13 / 500 | `#2f2f31` | |
| Tên issue trong hàng | 13 / 500 | `#1b1b1b` | |
| Mã issue | 13 / 450, letter-spacing −0.26px | `#5c5c5e` | |
| Ngày trong hàng | 12 / 450 | `#5c5c5e` | |
| Nhãn hàng nhóm ("Todo") | 13 / 500 | `#2f2f31` | |
| Chip view, nút "New issue", chip thuộc tính | 12 / 500 | `#5c5c5e` | |
| Mục menu chuột phải | 13 / 450 | `#303032` | Phím tắt bên phải 11 / 500, `#5e5e60` |
| Ô nhập Cmd+K | 13 | `#303032` | |
| Mục Cmd+K | 13 / 450 | | |
| Tooltip | 11 / 450 | `#303032` | |
| Tiêu đề hộp tạo issue | 18 / 600, letter-spacing −0.1px | `#1b1b1b` | |
| Mô tả hộp tạo issue | 15 / 450, line-height 22.5px | `#2f2f31` | |
| Tiêu đề trang chi tiết | 24 / 600, line-height 32px, letter-spacing −0.16px | `#1b1b1b` | |
| Thân trang chi tiết | 15 / 450, line-height 24px, letter-spacing −0.1px | `#2f2f31` | |
| Tiêu đề nhóm thuộc tính ("Properties", "Labels") | 13 / 500 | `#5c5c5e` | |

Quy luật:

- Chữ giao diện xoay quanh **12 và 13px**; nội dung soạn thảo 15px; tiêu đề 18–24px.
- Phân cấp bằng **màu (độ sáng)** nhiều hơn bằng cỡ chữ.
- Letter-spacing hơi âm ở chữ 13px trở lên.

---

## 3. Bo góc

**Thang của app (B)**:

| Thành phần | Bo góc |
|---|---|
| `--control-border-radius` | 4px |
| Khối editor | 6px |
| Bình luận, date picker | 8px |
| Hàng danh sách trong Settings | 10px |

Thang website (A): `4 / 6 / 8 / 12 / 16 / 24 / 32 / 9999px`.

**Trên DOM (C)**:

| Thành phần | Bo góc |
|---|---|
| Khung nội dung chính | 12px |
| Menu chuột phải, Cmd+K, ô nhập Cmd+K | 12px |
| Hộp tạo issue | 21px |
| Mục sidebar; nền rê chuột hàng issue; hàng nhóm | 8px |
| Vùng tô sáng mục menu | 8px (lùi 6px mỗi bên) |
| Tooltip | 8px |
| Keycap | 3px (Cmd+K), 4px (tooltip) |
| Nút chính, nút phụ, chip view, chip thuộc tính, nút icon 28px | 9999px (viên thuốc / tròn) |

Quy luật: **bo lồng nhau**. Lớp ngoài 12px chứa phần tử bên trong 8px, lùi vào 6–8px, nên hai đường cong gần đồng tâm. Control nhỏ bo tròn hẳn.

---

## 4. Kích thước và khoảng cách (C, trừ chỗ ghi B)

| Thành phần | Số đo |
|---|---|
| Sidebar | `--sidebar-width` 244px (B); khối sidebar đo được 247px |
| Mục sidebar | Cao 28px, đệm `0 9px 0 8px`, cách nhau 1px (bước 29px), icon 16px (hình vẽ 14px) |
| Tab desktop | 40px (B) |
| Khung nội dung | Cách mép trên 8px, bo 12px, viền 0.5px `#e2e2e2`, bóng 2 lớp nhẹ (mục 5) |
| Header trang | Cao 44px, **không kẻ đáy** |
| Chip view | Cao 28px, đệm ngang 10px, viên thuốc |
| Nút icon trên toolbar | 28×28, tròn |
| Nút "New issue" (phụ) | Cao 28px, đệm `0 10px 0 8px` |
| Hàng nhóm ("Todo 4") | Cao 36px, nền `#efeff0`, bo 8px |
| **Hàng issue** | **Bước 44px**; phần nội dung 36px; nền rê chuột lùi 8px mỗi bên, bo 8px |
| Icon trong hàng | Menu "⋯" 16px, trạng thái 14px, avatar người nhận 18px |
| Menu chuột phải | Rộng 180px; mục cao 32px, đệm `0 18px 0 14px`; tô sáng lùi 6px; icon 16px |
| Cmd+K | Rộng 720px, cách mép trên 123px (13% chiều cao); ô nhập cao 40px, đệm `11px 12px`; mục cao 46px; icon 16px |
| Keycap Cmd+K | 20×21, đệm 4px, chữ 11px, nền trong suốt, viền 0.5px `#e8e8e8`, bo 3px |
| Hộp tạo issue | Rộng 750px, cách mép trên 123px (13%); chip thuộc tính cao 24px, đệm `0 8px 0 6px`; nút chính cao 28px, đệm ngang 10px |
| Tooltip | Cao 28px, cách control 8px, keycap 18×17 |
| Trang chi tiết | Cột nội dung khoảng 790px; cột thuộc tính bên phải; mỗi nút thuộc tính cao 28px, viên thuốc, đệm `0 10px 0 6px`, bước 32px |
| Hàng Settings (B) | Cao tối thiểu 60px, đệm 12/16px, khoảng cách 12px, bo 10px |
| Thanh cuộn | 12px (B); website 6px |
| Nút website (A, không phải app) | mini 24px/12px chữ, small 32/13, medium 40/13, default 40/15, large 44/16 |

Quy luật:

- Control tiêu chuẩn **28px**, chip trong hộp **24px**, hàng danh sách **44px**, hàng nhóm và ô nhập lớn **36–40px**.
- Lớp nổi lớn (Cmd+K, hộp thoại) **đặt cố định ở 13% chiều cao**, không căn giữa dọc.

---

## 5. Độ nổi: viền, bóng, lớp phủ (C; A ghi rõ)

**Viền**:

- Mọi viền là **hairline 0.5px**.
- Nút phụ và chip **không có border**: viền vẽ bằng `::after` với `box-shadow: 0 0 0 0.5px rgb(0 0 0 / 0.09)`, cộng bóng mềm.

**Bóng (theme Light)**:

| Mức | Giá trị | Dùng cho |
|---|---|---|
| Thấp | `0 3px 6px -2px rgb(0 0 0/.02), 0 1px 1px rgb(0 0 0/.04)` | Nút, chip, khung nội dung, tooltip |
| Menu | `0 6px 18px rgb(0 0 0/.02), 0 3px 9px rgb(0 0 0/.04), 0 1px 1px rgb(0 0 0/.04)` | Menu chuột phải |
| Lớp nổi lớn | `0 9px 48px rgb(0 0 0/.08), 0 6px 24px rgb(0 0 0/.10), 0 1px 1px rgb(0 0 0/.04)` | Cmd+K, hộp thoại |
| Website (A) | low `0 1px 4px -1px #00000017`; medium `0 3px 12px #00000017`; high `0 7px 24px #0000000f` | Light. Dark đậm hơn: `#0000001a` … `#00000059` |

**Lớp phủ**: hộp thoại có nền đen 25%; Cmd+K không phủ.

**Header không kẻ đáy.** Các vùng tách nhau bằng chênh độ sáng nền (canvas `#efeff0` và nội dung `#f9f9fa`) cùng một viền 0.5px quanh khung. Đây là cách thực hiện "structure should be felt not seen".

---

## 6. Chuyển động (B)

**Tốc độ của app**:

| Token | Giá trị |
|---|---|
| `--speed-quickTransition` | 100ms |
| `--speed-regularTransition` | 250ms |
| `--speed-slowTransition` | 350ms |
| `--speed-highlightFadeIn` | **0s** |
| `--speed-highlightFadeOut` | **150ms** |

Nghĩa là vùng tô sáng **hiện ngay** khi rê chuột hoặc focus, nhưng **mờ dần 150ms** khi rời đi.

- **Easing**: bộ Penner đầy đủ (`--ease-out-quart: cubic-bezier(.165,.84,.44,1)`, `--ease-out-expo: cubic-bezier(.19,1,.22,1)`, `--ease-in-out-cubic: cubic-bezier(.645,.045,.355,1)`…), giống nhau giữa website và app.
- **Trên DOM (C)**: mục sidebar không có CSS transition khi rê chuột (đổi tức thì).
- Đổi theme dùng View Transition.

## 7. Tương tác và trạng thái (C)

- **Focus**:
  - Viền **1px liền màu accent `#6d78d5`, offset 0** (B: `--focus-ring-width: 1px`). Website (A) dùng 2px, offset 2px.
  - Đóng hộp thoại bằng Esc thì **focus trả về control mở nó** (nút "New issue" hiện viền focus).
- **Menu**:
  - Chuột và bàn phím **dùng chung một vùng tô sáng** (`data-focused`).
  - Phím tắt hiện bên phải dưới dạng chữ trơn 11px màu mờ (menu chuột phải), hoặc keycap viền hairline (Cmd+K, tooltip).
  - Mũi tên báo có submenu.
- **Cmd+K có ngữ cảnh**: khi đang trỏ vào một issue, ô lệnh hiện chip của issue đó và đưa các thao tác cho nó lên đầu ("Assign to…", "Change status…", "Set priority…"), kèm phím tắt.
- **Tooltip sáng** (nền trắng, viền hairline, bóng thấp), có tên thao tác và keycap phím tắt, cách control 8px.
- **Trạng thái chọn**:
  - Nền xám đậm hơn một bậc (sidebar `#e1e1e2`, chip `#ececed`, menu `#f1f1f1`), chữ chuyển sang mức chữ chính.
  - Không đổi sang màu accent.
- **Nút phụ**: nền trắng + vòng hairline + bóng mềm. **Nút chính**: nền accent, chữ trắng, viên thuốc 28px.
- **Thuộc tính ở trang chi tiết**: nút viên thuốc không nhãn (trạng thái, độ ưu tiên, người nhận), nhóm dưới tiêu đề "Properties", "Labels", "Project".

---

## 8. Đối chiếu QCET và đề xuất

> **Đã duyệt 22/10/2026, áp dụng trên `feat/linear-tokens` trừ nhóm Giữ (mục 8.4).**
>
> Cột QCET là code ngày 22/10/2026, **trước** khi áp dụng. Đường dẫn rút gọn:
>
> | Viết tắt | Đường dẫn |
> |---|---|
> | `G` | `apps/web/src/app/globals.css` |
> | `ui/` | `apps/web/src/components/ui/` |
> | `layout/` | `apps/web/src/components/layout/` |
> | `ws/` | `apps/web/src/components/workspace/` |

### 8.1. Đã khớp với Linear

| Hạng mục | Linear | QCET |
|---|---|---|
| Nền canvas/sidebar | `#efeff0` | `--gray-1: #EFEFF0` (G:231) |
| Nền nội dung | `#f9f9fa` | `--card` = `--gray-2: #F9F9FA` (G:232, 254) |
| Hàng sidebar đang chọn | `#e1e1e2` | `--sidebar-accent: #E1E1E2` (G:413) |
| Vùng đang chọn | `#ececed` | `--selected: #EBEBEC` (G:267) |
| Mục sidebar | 28px, 13px/500; nhãn nhóm 12px/500 | 28px, `text-compact` 500; nhãn `text-xs` 500 (`layout/sidebar-nav-list.tsx`) |
| Bề rộng sidebar | 244px (B) / 247px đo | `SIDEBAR_EXPANDED_WIDTH = 247` (`layout/sidebar-context.tsx:147`) |
| Header trang | 44px | `h-[calc(44px+…)]` (`ws/list-page-header.tsx:17`) |
| Bóng nút phụ | `0 0 0 .5px /.09, 0 3px 6px -2px /.02, 0 1px 1px /.04` | Giống hệt (`ui/button.tsx:30`) |
| Tooltip | nền sáng, cách 8px | `bg-popover`, `sideOffset` 8 (`ui/tooltip.tsx:97`) |
| Trạng thái chọn dùng xám, không dùng màu thương hiệu | ✓ | ✓ (`--selected`, `--sidebar-accent`) |

### 8.2. Khác biệt và đề xuất

Nhóm **Nhanh** là thay đổi token, ít rủi ro. Nhóm **Cần duyệt** đụng tới quyết định UI hoặc nhiều màn. Nhóm **Giữ** là không nên làm theo Linear.

| # | Hạng mục | Linear | QCET hiện tại | Đề xuất | Nhóm |
|---|---|---|---|---|---|
| 1 | Viền/đường chia | Xám trung tính: hairline `#e8e8e8`, khung `#e2e2e2`, 0.5px | `--border` = `--gray-4: #EAEDF1` ánh xanh, 1px (G:289) | Chuyển `--gray-4` sang xám trung tính cùng độ sáng; cân nhắc 0.5px cho viền lớp nổi trên màn mật độ cao | Nhanh |
| 2 | Chữ phụ | `#5c5c5e` trung tính, C ≈ 1 | `--muted-foreground` = `#5F6671` ánh xanh (G:241, 264) | Trung tính hóa, giữ tỉ lệ tương phản hiện có (5.8:1) | Nhanh |
| 3 | Số mức chữ | 4 mức (9.8 / 19.6 / 39.2 / 64.6 L) | 2 mức: `foreground`, `muted-foreground` | Thêm mức "mờ" cho placeholder/disabled (≈ `#9c9d9f`; hiện `--gray-8 #9AA0A9` chỉ là màu disabled) và cân nhắc mức thân văn bản `#2f2f31` | Cần duyệt |
| 4 | Lớp phủ hộp thoại | Đen 25% | `--overlay: rgba(0,0,0,.40)` (G:285); DESIGN.md đã ghi khác biệt | Hạ xuống 25% | Nhanh |
| 5 | Bóng hộp thoại | 3 lớp nhẹ + viền 0.5px | `--shadow-dialog: 0 24px 60px -20px rgb(0 0 0/.35)` (G:294) | Theo 3 lớp của Linear (mục 5) + viền hairline | Nhanh |
| 6 | Vị trí hộp thoại / Cmd+K | Cách mép trên 13% | Cách mép trên 10% (`ui/dialog.tsx`) | Không bắt buộc; giữ 10% nếu đã duyệt | Giữ |
| 7 | Bo hộp thoại | 21px (hộp tạo issue) | `rounded-2xl` 16px (`ui/dialog.tsx:75`) | Giữ 16px trừ khi làm lại hộp tạo việc | Giữ |
| 8 | Menu: kích thước | Mục 32px, 13px/450; rộng 180px | `MENU_ROW_CLASS` `h-7` 28px, `text-xs` (`ui/menu.tsx:22`); `min-w-[12rem]` (`ui/menu.tsx:364`) | AGENTS.md đã chốt `text-xs` cho popover/menu và mục ≤ 32px: **giữ**, chỉ đổi nếu chủ sở hữu muốn 13px như Linear | Cần duyệt |
| 9 | Menu: bo và tô sáng | Popup bo 12px; tô sáng lùi 6px, bo 8px | Popup `--radius-menu` 14px (`ui/menu.tsx:31`); mục `rounded-md` 12px | Popup 12px, mục 8px để bo đồng tâm với lề `p-1` | Nhanh |
| 10 | Bóng menu | Viền 0.5px + 3 lớp (/.02, /.04, /.04) | `--shadow-menu`: vòng 1px /.09 + 3 lớp (G:296) | Gần giống; có thể đổi vòng 1px thành 0.5px | Nhanh |
| 11 | Keycap | Nền trong suốt, viền 0.5px, 11px, bo 3–4px | `ui/kbd.tsx:9`: nền `bg-muted`, `text-xs` 12px, viền `border-border` | Bỏ nền xám, viền hairline. 11px là **cỡ lẻ bị lint chặn**: giữ 12px hoặc thêm 11px vào thang (cần duyệt) | Cần duyệt |
| 12 | Rê chuột hàng bảng | Nền bo 8px, **lùi 8px** mỗi bên, màu = canvas | Tô kín hàng, `color-mix(muted 40%, card)` (`ui/table.tsx:100`) | Thử nền lùi + bo 8px trên một bảng trước | Cần duyệt |
| 13 | Khung trang | Bo 12px, viền 0.5px, bóng 2 lớp thấp | `md:rounded-2xl` 16px, `shadow-2xs`, viền 1px (`layout/app-shell.tsx:238–240`) | Bo 12px, viền hairline, bóng thấp của Linear | Cần duyệt |
| 14 | Kẻ đáy header | Không kẻ | `border-b border-border/60` (`ws/list-page-header.tsx:17`) | Bỏ đường kẻ, tách bằng nền và khoảng trắng | Cần duyệt |
| 15 | Viền focus | 1px accent, offset 0 | `focusRingClass` 2px primary, offset 1 (`ui/focus-ring.ts:6–7`); ô nhập 1px (`fieldFocusRingClass`) | **Giữ 2px** cho nút và hàng vì dễ thấy hơn (hướng WCAG 2.2, mục 2.5 tài liệu nguyên tắc); ô nhập đã 1px như Linear | Giữ |
| 16 | Chuyển động | 100 / 250 / 350ms; tô sáng hiện 0s, mờ 150ms | `--motion-duration-micro: 80ms` (G:422) khác `motionDuration.micro = 0.1` (`lib/motion/tokens.ts`) | Đồng bộ micro = 100ms; áp mẫu "hiện ngay, mờ 150ms" cho tô sáng menu và hàng | Nhanh |
| 17 | Weight chữ | Thân chữ 450 | Be Vietnam Pro là font tĩnh (400/500/600/700) | **Không áp dụng được** 450; giữ 400 cho thân, 500 cho nhãn | Giữ |
| 18 | Màu accent | Indigo, chỉ cho nút chính, focus, vùng chọn | Xanh thương hiệu `#0058A0` | Giữ màu thương hiệu; học cách dùng accent **thật ít** | Giữ |
| 19 | Dark mode | Sinh từ 3 đầu vào (base/accent/contrast) + preset tương phản cao | Không có dark mode (G:74; `<html class="light">`) | Nếu làm dark mode sau này: sinh theme từ OKLCH với biến contrast và hỗ trợ `prefers-contrast: more` | Cần duyệt |
| 20 | Thuộc tính trang chi tiết | Nút viên thuốc không nhãn, gom dưới tiêu đề nhóm | Lưới nhãn–giá trị (quy tắc trong AGENTS.md) | **Giữ quy tắc đã duyệt**; chỉ ghi nhận khác biệt | Giữ |
| 21 | Hàng bảng Nhiệm vụ | Hàng issue 44px; hàng bảng Projects **48px** (đo 22/10/2026, mục 8.4) | 48px, "như bảng Projects của Linear" (AGENTS.md) | Đã khớp, giữ 48px | Giữ |
| 22 | Token khai báo nhưng không dùng | — | Khối `--control-height*`, `--row-height-*`, `--menu-item-height`, `--space-*`… (G:318–408) không component nào dùng | Hoặc nối vào component, hoặc dọn trong một đợt riêng | Cần duyệt |

### 8.3. Thứ tự gợi ý nếu được duyệt

1. **Token trung tính** (mục 1, 2, 4, 5, 10, 16): chỉ đổi biến trong `globals.css`. Kiểm bằng ảnh chụp các trang chính và `npm run lint`.
2. **Bo đồng tâm cho menu** (mục 9) và **keycap** (mục 11): sửa trong `ui/`, ảnh hưởng toàn app nên đo DOM lại sau khi sửa.
3. **Bố cục khung trang và hàng** (mục 12, 13, 14): làm thử trên một trang danh sách, đối chiếu với trang Nhiệm vụ rồi mới nhân rộng.

### 8.4. Đã áp dụng (22/10/2026, nhánh `feat/linear-tokens`)

| # | Đã làm | Chỗ sửa |
|---|---|---|
| 1, 2 | Thang xám `--gray-3`…`--gray-8`, `--gray-11`, `--control-edge` sang xám trung tính, giữ độ sáng L* (tương phản không đổi: chữ phụ 5.8:1 trên trắng, nét điều khiển 3.02:1 trên `--gray-3`) | `G` |
| 3 | Thêm `text-body-foreground` `#2F2F31` (thân editor, bình luận) và `text-faint` = `--gray-8` `#9F9FA2` (mọi placeholder) | `G`, `ui/input`, `ui/textarea`, `ui/list-toolbar`, editor, bình luận, các hộp tạo |
| 4, 5 | `--overlay` 25%; `--shadow-dialog` vòng 0.5px + 3 lớp của Linear | `G` |
| 8 | Mục menu 32px, chữ 13px (`text-compact`) cho menu, menu chuột phải, menu "/", thanh thao tác hàng loạt, bảng lệnh ⌘K, `Select` compact | `ui/menu`, `ui/select`, các menu riêng |
| 9, 10 | `--radius-menu` 12px, mục bo 8px; `--shadow-menu` vòng 0.5px | `G`, `ui/menu`, `ui/select` |
| 11 | `Kbd` nền trong suốt, `border-hairline`, chữ `text-micro` 11px (thêm cỡ này vào thang, chỉ cho keycap và gợi ý phím tắt) | `ui/kbd`, `G`, `lib/utils.ts` (tailwind-merge) |
| 12 | Khung bảng `px-2`, ô đầu/cuối bớt 8px: chữ giữ chỗ cũ, nền rê/chọn lùi 8px bo 8px, bật ngay khi rê; hàng nhóm và sổ văn bản theo cùng kiểu | `ui/table`, `G`, bảng Nhiệm vụ, `/org`, sổ văn bản |
| 13 | Khung trang và thẻ trang bo 12px, `border-hairline` (0.5px trên màn ≥ 2x), `shadow-low` | `layout/app-shell`, `ws/page-card`, sổ văn bản, chi tiết cuộc họp và khung chờ |
| 14 | Bỏ kẻ đáy header 44px | `ws/list-page-header`, `ws/page-card`, Hộp thư, Ghi chú, khung chờ |
| 16 | `--motion-duration-micro` 100ms; mục menu và hàng bảng tô ngay (0s), mờ 150ms | `G`, `ui/menu` |

Không làm (nhóm Giữ): 6, 7, 15, 17, 18, 19, 20, 22.

Bảng Projects của Linear (đo DOM 22/10/2026, theme Light): hàng 48px, tên 13px/500; tiêu đề cột 32px, chữ 12px/450, không kẻ đáy; vùng tô sáng là `::before` lùi 8px hai bên, bo 8px, như hàng issue.

## 9. Chưa đo

- Theme Dark trên DOM thật (chỉ có input và hex khung khởi động).
- Board, Inbox, timeline, Settings, giao diện điện thoại.
- Thời lượng và easing thực tế khi mở/đóng menu, hộp thoại.
- Empty state, toast, trạng thái lỗi.

Đo lại khi cần: mở app ở theme cần đo, viewport cố định, chạy `getComputedStyle` trên phần tử, đọc vùng tô sáng bằng `getComputedStyle(el, '::before')`. Viền nút phụ nằm ở `::after`.

## Nguồn

- CSS website: `https://linear.app/` (các file `static.linear.app/web/_next/static/css/*.css`), tải ngày 22/10/2026.
- Bundle app: `https://linear.app/login` → `static.linear.app/client/assets/style-*.css`, `startup-*.js` và các chunk tải lười, tải ngày 22/10/2026.
- DOM thật: app Linear đã đăng nhập (theme Light), đo ngày 22/10/2026.
- Bối cảnh thiết kế: [A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh), [How we redesigned the Linear UI (part II)](https://www.linear.app/now/how-we-redesigned-the-linear-ui).
