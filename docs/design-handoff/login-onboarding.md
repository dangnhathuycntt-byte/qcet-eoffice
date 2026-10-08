# Bàn giao: Đăng nhập và hướng dẫn lần đầu

Xuất từ canvas QCET E-Office, trang "Đăng nhập & onboarding", bản 308 (05/10/2026). Đối chiếu với repo ở commit 16ad8e5b. Đây là tài liệu thiết kế, không phải code; ai làm thì làm theo nhánh và PR như thường lệ.

## Bảng

| Bảng | Nội dung | Tệp |
|---|---|---|
| Login | 10 trạng thái: mặc định, sai tên miền, chưa được cấp quyền, đang chuyển sang Google, đã đăng nhập trước đó, focus bàn phím, trong ứng dụng chat, vào từ liên kết, phiên hết hạn, đã đăng xuất; 11 ghi chú kỹ thuật | project/Login.dc.html · shots/Login.png |
| LoginDesktop | Khung máy tính 1440×900 | project/LoginDesktop.dc.html · shots/LoginDesktop.png |
| Login2 | Chưa được cấp quyền, gửi yêu cầu, đã gửi, tài khoản bị khóa, máy dùng chung (prompt=select_account), không kết nối được Google; quy tắc sau đăng nhập | project/Login2.dc.html · shots/Login2.png |
| LoginMobile | Máy tính bảng và di động | project/LoginMobile.dc.html · shots/LoginMobile.png |
| FeatureGuide | Thay onboarding toàn màn hình bằng thẻ nhỏ gắn vào giao diện thật | project/FeatureGuide.dc.html · shots/FeatureGuide.png |

`Onboarding` và `OnboardingMobile` trong thư mục này là bản cũ: **Superseded · reference only**, không làm theo.

## Quyết định

1. **Không còn onboarding toàn màn hình.** Sau đăng nhập vào thẳng nơi đang định tới (mặc định Nhiệm vụ). Hướng dẫn là Feature guide: tối đa 3 thẻ mỗi màn hình, chỉ hiện lần đầu mở màn hình đó, tắt bằng Xong, bấm ra ngoài hoặc Esc; tắt rồi không hiện lại; xem lại ở Trợ giúp → Hướng dẫn.
2. **Ba thẻ đầu tiên:** Văn bản đến ("Ký ngay trên văn bản."), Nhiệm vụ ("Việc gần hạn nằm trên cùng."), Ủy quyền ("Vắng mặt? Ủy quyền cho người khác."). Trên di động thẻ nằm ở đáy màn hình.
3. **Quyền thông báo** không hỏi trong hướng dẫn; hỏi khi có việc đầu tiên sắp đến hạn.
4. Thẻ không chặn thao tác: role dialog, không khóa focus; hiện dần 180ms, trượt 8px; giảm chuyển động thì chỉ hiện dần.

## Quy tắc đăng nhập (từ ghi chú trên bảng)

- Chỉ nhận @cdktcnqn.edu.vn: gợi ý bằng tham số `hd`, **kiểm lại ở máy chủ**, không tin phía trình duyệt.
- Nhận diện người dùng bằng `sub` của Google, không dùng email làm khóa.
- Đã đăng nhập trước đó: một lần bấm, gửi email lần cuối làm `login_hint`; luôn có "Dùng tài khoản khác".
- Máy dùng chung: `prompt=select_account`.
- Trình duyệt trong ứng dụng chat bị Google chặn (403 disallowed_useragent): nhận diện theo User-Agent, chặn nút Google, hướng dẫn mở bằng trình duyệt ngoài.
- Ứng dụng di động mở đăng nhập bằng trình duyệt hệ thống, không dùng WebView.
- Vào từ liên kết sâu hoặc phiên hết hạn: giữ đường dẫn đích (chỉ nhận đường cùng miền), sau đăng nhập về đúng trang; giữ bản nháp đang soạn.
- Chưa được cấp quyền: gửi yêu cầu cấp quyền kèm tên và email (Quy trình 1; hàng đợi cấp quyền trong repo đang Missing).
- Lỗi mạng hoặc Google: thử lại tại chỗ, không đưa về trang trống.
- Lỗi đọc bằng aria-live, có chữ và liên kết xử lý, không chỉ dựa vào màu; tiêu đề tab có tiền tố "Lỗi:".
- Hỗ trợ dùng hộp thư chung hotro@cdktcnqn.edu.vn.

## Đối chiếu repo (16ad8e5b)

| Hạng mục | Repo | Việc |
|---|---|---|
| Trang đăng nhập | `src/app/login/page.tsx` đã có startGoogle, `prompt`, đăng nhập nhanh bằng `login_hint`, luồng account_not_found / AccessDenied gửi yêu cầu, server_error | Rà từng trạng thái trong bảng Login, Login2; chưa kiểm: chặn trình duyệt trong ứng dụng chat, phiên hết hạn giữ bản nháp, tài khoản bị khóa |
| Onboarding | `src/app/onboarding/page.tsx` vẫn hiện `OnboardingFlow` toàn màn hình; `app-shell.tsx` còn tham chiếu `/onboarding` | Bỏ chuyển hướng lần đầu sang `/onboarding`; `/onboarding` chuyển về Nhiệm vụ hoặc Trợ giúp → Hướng dẫn |
| Feature guide | `src/components/feature-guide/feature-guide.tsx` có `FeatureGuideCard` (lưu đã xem trong localStorage `qcet_fg_*`) nhưng chưa màn hình nào dùng | Gắn 3 thẻ ở Văn bản đến, Nhiệm vụ, Ủy quyền; thêm mục Trợ giúp → Hướng dẫn. Đề xuất lưu đã xem vào `User.onboardingData` để đồng bộ nhiều máy (không bắt buộc) |
| Hàng đợi cấp quyền | Missing (Bản đồ 01) | Theo Quy trình 1, model AccessRequest cần ADR |

## Cần chốt

- Bảng Login2, quy tắc 1 còn ghi "Lần đầu đăng nhập: vào onboarding 3 bước". Bảng FeatureGuide (mới hơn) thay quy tắc này; làm theo FeatureGuide.
- Chữ trên màn đăng nhập ghi "QCET Work chỉ nhận tên và email của bạn"; tên ứng dụng trong repo và thanh bên là "QCET E-Office". Đề xuất thống nhất "QCET E-Office".

Kiểm tra trước khi gộp: `npm run typecheck`; không chạy `next build` để kiểm.
