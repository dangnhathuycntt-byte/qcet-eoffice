# QCET E-Office · quy tắc design

Nguồn sự thật: ảnh trong `shots/` và bảng trong `project/`. Tệp này tóm tắt token và quy tắc. Khi mâu thuẫn, bảng mới nhất thắng.

## Màu (thang xám 12 bậc)
| Token ngữ nghĩa | Giá trị | Dùng cho |
|---|---|---|
| color-bg-app | #FAFBFC | nền trang |
| color-bg-panel | #FFFFFF | panel, hộp thoại, menu |
| color-bg-control | #F2F4F7 | ô nhập, nút phụ, chip |
| color-bg-hover | #EAEDF1 | di chuột dòng và nút |
| color-bg-selected | #DEE2E8 | dòng đang chọn |
| bậc 6 | #DADDE2 | ô chọn chưa tick, thanh mảnh |
| bậc 7 | #C9CDD3 | tay nắm, dấu chia, icon rất mờ |
| bậc 8 | #9AA0A9 | chữ và icon vô hiệu |
| color-action | #25282F | nút chính, ô tick |
| color-action-hover | #3A3D44 | nút chính khi di chuột |
| color-on-action | #FAFAFA | chữ trên nút chính |
| color-text-secondary | #5F6671 | nhãn, chú thích (5,8:1) |
| color-text-primary | #1A1D23 | chữ chính |
| color-feedback-danger | #B91C1C | lỗi, quá hạn |
| color-feedback-danger-bg | #FBEDED | nền ô lỗi, nút xóa |
| color-overlay | đen 40% | lớp tối sau hộp thoại |
| color-brand | #0058A0 | xanh của logo trường (lấy mẫu từ logo), tương phản 7,6:1 trên nền trắng. Dùng cho vòng focus và nhấn nhận diện, không dùng làm màu nút |
| color-icon-accent | #C0D0F4 | màu icon và mảng nhấn trong tranh minh họa (chốt). Nền nhạt, không dùng cho chữ |
| color-brand-accent | #F8F000 | vàng của logo, chỉ dùng trong logo và tranh, không dùng cho chữ hay nút |

Ánh xạ code hiện tại: bg-background=bg-app, bg-card/popover=bg-panel, bg-muted/secondary=bg-control, bg-accent=bg-hover, bg-primary=action, text-muted-foreground=text-secondary, text-destructive=danger.

## Hình khối
- Bo góc: 8 · 12 · 14 · 16 · 24. Nút và ô nhập bo 12.
- Hệ không dùng viền cứng. Thẻ: viền mảnh `0 0 0 1px #EAEDF1` kèm bóng nhẹ.
- Nút mặc định cao 34 (sm 28); ô nhập cao 36; trên điện thoại 48, chữ 16.
- Dòng bảng: gọn 40, mặc định 48, hai dòng 64. Avatar 20/24/32.
- Vùng bấm tối thiểu 44px trên di động.

## Icon
- Icon nghiệp vụ (thanh bên, menu, trạng thái rỗng) đặt trên chip 32, bo 10, nền #C0D0F4, nét 1.5 màu #1A1D23. Không tô icon bằng #C0D0F4 trực tiếp vì tương phản với nền trắng chỉ khoảng 1,5:1.
- Icon đứng cạnh chữ (bảng, nút) giữ màu chữ. Cỡ 16 (bảng, menu), 20 (thanh bên), 24 (rỗng).

## Chữ
Be Vietnam Pro (400/500/600). Giữ nguyên chữ tiếng Việt trong bảng.

## Đăng nhập
- Chỉ Google, chỉ @cdktcnqn.edu.vn; kiểm tra ở máy chủ; khóa người dùng theo `sub`.
- Nút Google: nền #131314, viền inset 1px #8E918F, chữ #E3E3E3 14/20 Medium, đệm 12/10/12, chữ G bản màu.
- Trình duyệt trong ứng dụng chat bị Google chặn (403 disallowed_useragent): hướng dẫn mở bằng trình duyệt ngoài.
- Giữ địa chỉ đích qua đăng nhập, chỉ nhận địa chỉ cùng miền.

## Onboarding
- Máy tính: trang toàn màn hình, không thanh bên; 3 bước cộng màn chào; có "Bỏ qua".
- Di động: lướt ngang, không nút ở các bước đầu; chỉ màn cuối có "Mở việc đầu tiên".
- Không hỏi quyền thông báo ở đây; hỏi khi người dùng đặt nhắc đầu tiên.
- Tôn trọng giảm chuyển động.
