# Quy tắc đánh bóng giao diện và chuyển động

## Nguồn và phạm vi

Quy tắc này được chắt lọc từ bài viết [The 10 rules to ship truly polished UI with Claude](https://x.com/kvnkld/status/2066863634949779464), đối chiếu qua bản mirror có toàn văn tại [Bittide](https://bittide.aicompass.dev/article/6aa384ce-6306-4737-8358-d9ad04db69a0). Áp dụng cho mọi UI frontend mới hoặc được chỉnh sửa trong dự án QCET.

Đây là tiêu chuẩn chất lượng bổ sung, không thay thế các quy tắc accessibility, hiệu năng, thuật ngữ hành chính, `Dependency-First Development` hoặc hạ tầng motion hiện có. Ưu tiên tái sử dụng token và primitive sẵn có; không tạo một hệ thống song song.

## 1. Easing là token, không dùng giá trị mặc định tùy tiện

- Không dùng trực tiếp `ease`, `ease-in-out` hoặc một `cubic-bezier(...)` rải rác trong component.
- Dùng `motionEase`, `motionTransition` từ `src/lib/motion/tokens.ts` và các variant đã có trong `src/lib/motion/variants.ts`.
- Khi một chuyển động mới thực sự cần đường cong khác, thêm token có tên và ngữ nghĩa rõ ràng vào hạ tầng motion, kèm test; không hardcode một lần.
- Điều chỉnh easing theo cảm giác chuyển động cụ thể: vào, ra, kéo, nảy hoặc chuyển trạng thái. Không dùng từ mô tả chung như “smooth” thay cho duration và curve cụ thể.

## 2. Xây design tokens trước component

Trước khi tạo component, xác định hoặc tái sử dụng token cho:

- màu nền, chữ, border và trạng thái;
- bán kính (`--radius-*`);
- duration và easing (`motionDuration`, `motionEase`);
- shadow theo lớp (`--shadow-*`);
- khoảng cách, typography và các biến thể density khi phù hợp.

Component phải dùng token hiện có, không tự sinh các giá trị lẻ như `13px`, `0.3s` hoặc shadow riêng chỉ vì tiện tay. Nếu token hiện có chưa phù hợp, cập nhật token dùng chung thay vì thêm ngoại lệ cục bộ.

## 3. Tương tác kéo phải có cảm giác vật lý

Với slider, panel, drawer hoặc phần tử kéo được:

- dùng primitive và dependency đã có (`@dnd-kit`, `motion`, `vaul`, `react-resizable-panels`) trước khi tự viết gesture;
- có thể hiện vận tốc đã làm mượt, quán tính khi thả, ma sát và giới hạn mềm khi nghiệp vụ cần;
- dùng spring đã được hiệu chỉnh cho giá trị không thể mô tả tốt bằng một duration cố định;
- không biến một tương tác kéo thành fade/slide theo thời gian cố định nếu người dùng đang trực tiếp điều khiển vị trí.

Chỉ bổ sung momentum, resistance hoặc spring khi chúng làm rõ affordance; không thêm hiệu ứng để trang trí.

## 4. Snap point phải có chủ đích và có hysteresis

Khi có các mốc có ý nghĩa (tháng, preset, ngưỡng nghiệp vụ):

- định nghĩa snap point bằng dữ liệu/token, không rải số magic trong handler;
- dùng vùng hút vào nhỏ hơn vùng thoát ra để tránh rung và giúp trạng thái đã bắt mốc không bị tuột ngay;
- cung cấp phản hồi nhẹ, không chỉ dựa vào màu sắc hoặc chuyển động;
- bảo đảm người dùng bàn phím, touch và người dùng giảm chuyển động vẫn thao tác được.

## 5. Entrance nên tập trung vào vị trí, opacity và blur

Mặc định cho nội dung xuất hiện là kết hợp:

- opacity `0 → 1`;
- dịch lên khoảng `6px → 0`;
- blur nhẹ khoảng `2px → 0`;
- duration và easing lấy từ motion token hiện có.

Dùng variant/primitive sẵn có hoặc tạo variant dùng chung khi cần; không tạo animation keyframe trùng lặp cho từng màn hình. Với danh sách dài, ưu tiên transform và opacity; chỉ dùng blur ở những điểm vào nhỏ, có chủ đích.

## 6. Độ sâu là ánh sáng nhiều lớp

- Không dùng một shadow đậm duy nhất để mô phỏng elevation.
- Dùng `--shadow-subtle`, `--shadow-card`, `--shadow-dropdown` hoặc token dùng chung tương ứng.
- Shadow nên gồm lớp tiếp xúc chặt, lớp ambient rộng và hairline ring khi phù hợp; opacity thấp, thường trong khoảng `2%–8%`.
- Không viết giá trị shadow inline trong component nếu có thể mở rộng token. Không thay border bằng shadow một cách mù quáng: border vẫn cần thiết khi cần tương phản, phân vùng hoặc accessibility.

## 7. Mọi control tương tác phải có phản hồi nhấn

- Trạng thái `:active` mặc định có thể scale nhẹ đến khoảng `0.98`, không co sập đến `0.9`.
- Dùng duration micro/fast và tránh xung đột với transform do drag hoặc layout animation.
- Hover, focus-visible, pressed, disabled và loading phải có trạng thái riêng; không dùng hover để thay thế focus-visible.
- Tooltip/popover xuất hiện bằng chuyển động ngắn có kiểm soát, không bật tức thời hoặc gây layout shift.

## 8. Expand/collapse phải theo đúng chiều cao thật

- Không dùng `max-height: 9999px` hoặc một giới hạn đoán mò.
- Với vùng CSS có chiều cao nội dung động, dùng kỹ thuật grid rows `0fr → 1fr` và đặt phần tử con `overflow: hidden`.
- Với primitive headless, ưu tiên `@base-ui/react/collapsible`.
- Khi phần tử di chuyển giữa hai container, dùng layout animation hoặc FLIP (First → Last → Invert → Play), không nhảy DOM rồi hy vọng transition tự bắt kịp.

## 9. Reduced motion, hiệu năng và accessibility là một phần của polish

- Tôn trọng `prefers-reduced-motion: reduce`; animation trang trí phải dừng, còn trạng thái nội dung phải hiển thị ngay và không mất thông tin.
- Giữ `MotionConfig reducedMotion="user"` và lớp reduced-motion toàn cục nhất quán; component mới không được vô hiệu hóa cơ chế này.
- Ưu tiên `transform` và `opacity` trên danh sách lớn; hạn chế animate shadow, blur, height hoặc layout trên bề mặt rộng.
- Kiểm tra keyboard navigation, focus-visible, contrast, touch target và trạng thái loading/error/success cùng với chuyển động.

## 10. Thiết kế theo hệ thống trạng thái

Một component không chỉ có ảnh chụp trạng thái nghỉ. Trước khi triển khai, liệt kê tối thiểu các trạng thái phù hợp:

- idle;
- hover và focus-visible;
- pressed/dragging;
- loading/working;
- disabled;
- success, error hoặc empty nếu nghiệp vụ có.

Sau khi dùng thử, bổ sung các trạng thái chỉ xuất hiện trong tương tác thật: số chạy từng chữ số, label shimmer khi đang xử lý, icon play/pause chuyển tiếp, hoặc phản hồi snap point. Không thêm spinner hay shimmer nếu nội dung hiện tại đã đủ rõ hoặc hiệu ứng làm giảm khả năng đọc.

## Quy trình triển khai và review

1. Đọc token và primitive hiện có trước khi viết CSS/animation mới.
2. Đưa token cần dùng lên đầu yêu cầu hoặc design handoff; cấm one-off value nếu không có lý do được ghi nhận.
3. Mô tả bằng số đo cụ thể: curve, duration, khoảng dịch chuyển, blur, scale và spring; không chỉ nói “premium” hoặc “smooth”.
4. Khi tinh chỉnh, cô lập một biến mỗi lần (entrance, shadow, press hoặc state) để tránh thrashing.
5. Review trên desktop, mobile, touch, keyboard và `prefers-reduced-motion` trước khi hoàn tất.
6. Nếu có Figma handoff, đối chiếu rõ padding, gap, token, màu, radius, cỡ/chữ đậm và các variant; không giả định công cụ handoff tự truyền đủ mọi thuộc tính.

### Definition of Done cho UI có chuyển động

- [ ] Dùng token/primitive canonical, không có easing, duration, radius hoặc shadow rải rác không giải thích được.
- [ ] Có trạng thái focus-visible, pressed, loading/disabled và lỗi/thành công khi phù hợp.
- [ ] Có fallback `prefers-reduced-motion` và không làm mất thông tin.
- [ ] Không dùng `max-height` hack cho nội dung động hoặc một shadow đơn đậm cho elevation.
- [ ] Đã kiểm tra hành vi thật trên viewport và input method liên quan.
