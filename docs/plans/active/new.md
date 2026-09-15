Plan triển khai cải thiện UX QCET                                                                                 
                                                                                                                  
Context                                                                                                           
                                                                                                                  
Người dùng yêu cầu cải thiện tổng thể UX, sau đó yêu cầu xuất plan chi tiết. Lượt này chỉ lập plan; chưa thực thi.
                                                                                                                  
Plan này thay thế bản trước và các brief A–D cũ. Không coi task nào đã hoàn thành chỉ vì ledger ghi “dispatching”; agent thực thi trước đã bị dừng, chưa có kết quả kiểm chứng.                                                      
                                                                                                                  
Các đính chính bắt buộc:                                                                                          
- smartFilterPills bị gỡ khỏi giao diện có chủ ý trong commit 076d798 để ưu tiên Saved Views và giảm số hàng toolbar. Khôi phục một số bộ lọc là điều chỉnh thiết kế, không phải khôi phục JSX bị vô tình xóa.               
- Không có dữ liệu để kết luận SUS 62/100, thao tác chậm gấp ba hay component nhiều dòng gây lag.                 
- Form đã có mục nâng cao; lịch đã có giao diện agenda trên mobile. Cải thiện những phần này, không xây lại.      
- Runner đúng: node scripts/run-tests.mjs --files <file...>. Truyền tên file không có --files chạy cả suite. Không dùng Vitest.                                                                                                    
- Baseline trước đã có lỗi thiếu .claude/agents/*.md. Không hứa toàn bộ suite xanh hoặc sửa cấu hình agent ngoài phạm vi UX.                                                                                                     
                                                                                                                  
▎ Cho agent thực thi: Dùng superpowers:subagent-driven-development hoặc workflow có implementer và reviewer độc lập. Hoàn thành theo từng task dưới đây; checklist chưa đánh dấu nghĩa là chưa làm. Không dùng các brief cũ làm yêu cầu thay thế plan này.                                                                                      
                                                                                                                  
Goal: Người dùng nhận diện đúng danh sách đang xem, lọc công việc dễ hơn, thao tác có phản hồi và không mất nội dung khi đóng nhầm form; sử dụng được bằng bàn phím và trên điện thoại.                                           
                                                                                                                  
Architecture: Giữ các component và design system hiện tại. UnifiedAdaptiveWorkspace là nơi điều phối tiêu chí lọc; toolbar phát sự kiện, table/Kanban hiển thị kết quả và trạng thái. Form và calendar cải thiện tại chỗ, không thêm lớp ứng dụng hay schema mới.                                                                                      
                                                                                                                  
Tech Stack: Next.js App Router, React, TypeScript, Tailwind, Lucide; Node test runner qua script của repo.        
                                                                                                                  
Spec: Yêu cầu trong hội thoại và hợp đồng hành vi trong plan này; chưa có spec riêng được duyệt. Tham chiếu PRODUCT.md, DESIGN.md, docs/ux/QCET_UI_VOCABULARY.md hiện có khi triển khai.                                      
                                                                                                                  
Global Constraints                                                                                                
                                                                                                                  
- Giữ toàn bộ thay đổi chưa commit; chỉ thêm diff cần thiết trên nội dung hiện tại. Không reset, restore, stash, clean, ghi đè file từ HEAD hoặc sửa file ngoài phạm vi.                                                         
- Không tự commit, push, merge, publish, tạo worktree hoặc đổi cấu hình. Không gửi dữ liệu nhiệm vụ/nhân sự ra dịch vụ ngoài.                                                                                                  
- Không thêm dependency, DnD, quick-create modal thứ hai, backend endpoint hoặc thay schema.                      
- Không nới phân quyền, lifecycle, Single DRI, yêu cầu sản phẩm đầu ra hoặc hạn nhiệm vụ con.                     
- Giữ thời gian Asia/Ho_Chi_Minh, chu kỳ tháng công tác 25–24, thuật ngữ tiếng Việt và theme light hiện tại.      
- Không sửa giao diện không được mount chỉ vì file tồn tại. Không thêm min-width vào week grid để “sửa mobile” đã dùng agenda.                                                                                                    
- Không chạy next build đồng thời next dev dùng cùng thư mục output. Đổi cổng không đồng nghĩa cô lập cache.      
- Ưu tiên token/component dùng chung đã có; không thêm hiệu ứng trang trí, refactor theo số dòng hoặc abstraction chỉ dùng một lần.                                                                                               
- Mỗi thay đổi logic phải có regression test; test source/SSR không được gọi là browser E2E.                      
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 1 — Chốt baseline và phạm vi diff
                                                                                                                  
Files đọc: package.json, scripts/run-tests.mjs, cấu hình Next.js, các file/task liên quan bên dưới; không sửa ứng dụng trong task này.                                                                                              
                                                                                                                  
- [ ] Ghi branch/HEAD và danh sách dirty/untracked hiện tại; không cố định số lượng “21 file” từ snapshot cũ.     
- [ ] Lưu diff baseline trong thư mục scratch của lần thực thi để reviewer phân biệt UX mới với WIP có sẵn. Không đưa secret hoặc .env vào gói review.                                                                            
- [ ] Kiểm tra liệu agent bị dừng đã để lại phần sửa nào; giữ lại nếu đúng, hoàn thiện thay vì viết chồng.        
- [ ] Kiểm tra test file tồn tại rồi chạy baseline bằng --files.                                                  
                                                                                                                  
node scripts/run-tests.mjs --files tests/task-table-engine.test.ts tests/role-pages-integration.test.ts tests/content-terminology.test.ts                                                                                 
npm run typecheck                                                                                                 
                                                                                                                  
- [ ] Sau khi được duyệt thực thi: dùng app dev đang chạy nếu có. Ghi ảnh baseline /, /tasks, /calendar, form và Kanban ở desktop 1440×900 và mobile 375×812; chỉ dùng phiên được phép hoặc dữ liệu thử.                         
- [ ] Nếu không đăng nhập được, tiếp tục kiểm tra code/tests, ghi rõ browser check bị chặn; không giả kết quả.    
                                                                                                                  
Đầu ra: Baseline lỗi hiện có, ảnh nếu truy cập được, danh sách file được giao cho từng worker. Mọi task sau đối chiếu baseline này.                                                                                               
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 2 — Đồng bộ lọc, drill-down và trạng thái rỗng
                                                                                                                  
Modify:                                                                                                           
- src/components/workspace/unified-adaptive-workspace.tsx                                                         
- src/components/tasks/table/modular-cascading-task-table.tsx                                                     
- src/components/tasks/table/components/task-empty-state.tsx                                                      
- src/hooks/use-workspace-query.ts, src/lib/workspace-query.ts: chỉ sửa nếu API hiện có không hỗ trợ cập nhật nguyên tử cần thiết.                                                                                            
                                                                                                                  
Tái sử dụng: handleFilterCanvasFromWorkbox, effectiveActiveTab, handleResetFilters, useWorkspaceQuery, parseWorkspaceQuery, TaskEmptyState.                                                                              
                                                                                                                  
Interface: Toolbar, Action Queue và bảng tổng hợp gọi cùng luồng chọn bộ lọc. URL chứa tiêu chí canonical; UI đọc lại cùng tiêu chí khi reload/Back. Không tạo thêm state store.                                                    
                                                                                                                  
Hợp đồng hành vi                                                                                                  
                                                                                                                  
┌───────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────┐                                                                                                              
│     Thao tác      │                                            Kết quả                                             │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Xem việc cần      │ Áp dụng attention chờ người hiện tại duyệt; xóa attention quá hạn/nộp còn sót                  │                                                                                                               
│ duyệt             │                                                                                                │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Xem việc chờ nộp  │ Áp dụng tiêu chí chờ người hiện tại nộp; không trộn với chờ duyệt                              │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Xem quá hạn       │ Áp dụng overdue theo predicate hiện có; không giữ status xung đột                              │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Chọn Tất cả       │ Bỏ bộ lọc nhanh; giữ scope, kỳ công tác và các bộ lọc nâng cao người dùng đã chọn              │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Xóa bộ lọc        │ Xóa search/status/attention/đơn vị con/category/priority và view đã lưu không còn khớp; giữ    │                                                                                                               
│                   │ scope được phép, kỳ công tác đang chọn, dạng xem và density                                    │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Lọc ra 0 kết quả  │ Hiện “Không có nhiệm vụ phù hợp” hoặc thông báo có từ khóa; có nút xóa lọc thực sự tác động về │                                                                                                              
│                   │  cha                                                                                           │                                                                                                               
├───────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Không có dữ liệu, │ Hiện hướng dẫn tạo/xem nhiệm vụ phù hợp quyền; không gợi ý reset vô nghĩa                      │                                                                                                               
│  không lọc        │                                                                                                │                                                                                                               
└───────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────┘                                                                                                              
                                                                                                                  
Kỳ công tác có điều khiển đổi kỳ riêng và phải hiển thị rõ. “Xóa bộ lọc” không âm thầm chuyển sang dữ liệu cả năm hoặc mở rộng scope.                                                                                               
                                                                                                                  
- [ ] Viết test đỏ: chọn chờ duyệt sau quá hạn, trở về Tất cả, reset tìm kiếm, serialize/parse lại tiêu chí giữ cùng kết quả.                                                                                                   
- [ ] Gộp chuyển bộ lọc thành một thao tác cập nhật URL bằng API hiện có. Không gọi nhiều setter điều hướng độc lập nếu chúng cùng đọc URL cũ và ghi đè nhau.                                                                   
- [ ] Click drill-down có chủ đích tạo history entry; gõ search dùng replace. Back/Forward khôi phục đúng bộ lọc. Không thêm history entry khi chọn lại cùng trạng thái.                                                          
- [ ] Dùng cùng handler cho các nút tóm tắt, drawer và toolbar; xóa logic chuyển trạng thái trùng nếu có.         
- [ ] Truyền ngữ cảnh hiển thị empty state và callback reset vào cả hai nhánh table của workspace. Không dùng initialTab để đồng bộ prop động; không bắt table lọc lần hai danh sách/subtasks đã lọc ở cha.                   
- [ ] Xác định cờ có lọc từ cả search, attention, status, category, priority và đơn vị con; tránh bỏ sót trường chỉ có ở cha.                                                                                                   
- [ ] Cập nhật test và chạy lại test tập trung; giữ quyền tạo việc của empty state như trước.                     
                                                                                                                  
Nghiệm thu: URL, trạng thái đang chọn, số kết quả và nút reset nhất quán; reload/Back không mất ngữ cảnh; không làm mất nhiệm vụ con do lọc kép.                                                                                  
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 3 — Toolbar dễ hiểu, lọc nhanh có chọn lọc
                                                                                                                  
Modify: src/components/dashboard/unified-task-toolbar.tsx và phần kết nối trong unified-adaptive-workspace.tsx.   
                                                                                                                  
Tái sử dụng: smartFilterPills, tabCounts, SavedViewsSelector, onTabChange, ActiveFilterBreadcrumb hiện có. Dùng kết quả Task 2, không viết handler lọc thứ hai.                                                                   
                                                                                                                  
Bố cục đề xuất                                                                                                    
                                                                                                                  
Desktop, hai nhóm hàng:                                                                                           
[Scope: Cá nhân | Đơn vị | Trường]                         [+ Giao việc]                                          
[Góc nhìn] [Tìm kiếm…] [Lọc nhanh] [Bộ lọc N] [Hiển thị]                                                          
                                                                                                                  
Chỉ khi có tiêu chí đang áp dụng:                                                                                 
[Quá hạn ×] [Ưu tiên cao ×] [Từ khóa ×]     Xóa bộ lọc                                                            
                                                                                                                  
- Giữ Saved Views cho tổ hợp tiêu chí; không dùng “Tất cả nhiệm vụ” trên trigger khi dữ liệu thực tế đang bị lọc khác.                                                                                                           
- Lọc nhanh: Tất cả, một lựa chọn hành động phù hợp vai trò (Cần tôi duyệt hoặc Chờ tôi nộp), Quá hạn. Hôm nay và lựa chọn còn lại nằm trong bộ lọc mở rộng. Nhãn “Cần tôi…” chỉ dùng nếu predicate và count thực sự là nhiệm vụ của người hiện tại.                                                                                             
- Không hiện lại “Của tôi” như status: đây là scope.                                                              
- Mobile: search đủ chiều rộng; nhóm nút được wrap trong khu vực điều khiển, không gây body scroll ngang. Không ép toàn bộ desktop toolbar vào một hàng 375px.                                                                     
- [ ] Viết test đỏ cho cách chọn hành động theo role, trạng thái selected khi count bằng 0, callback thay đổi bộ lọc và tên bộ lọc nâng cao.                                                                                     
- [ ] Render bộ lọc nhanh có aria-pressed, type="button", vùng chạm ít nhất 44px trên mobile, focus rõ. Dùng role="group" cho nút lọc; không gắn tab semantics nếu không có keyboard tab pattern đầy đủ.                     
- [ ] Count lấy từ cùng scope/kỳ và quy tắc tính hiện có; không tính lại theo tập kết quả đã bị chính bộ lọc đó giới hạn.                                                                                                       
- [ ] Hiện trạng thái lọc đang áp dụng bằng breadcrumb/chip hiện có. Mỗi nút xóa một tiêu chí chỉ xóa tiêu chí đó.
- [ ] Sau khi sửa thủ công tiêu chí của Saved View, không tiếp tục báo preset đang active nếu criteria đã lệch.   
- [ ] Chạy tests và xem desktop/mobile cùng một lượt; không thêm KPI, card hoặc banner để bù bố cục.              
                                                                                                                  
Nghiệm thu: Bộ lọc nhanh đã chọn dùng được một lần bấm; các lựa chọn còn lại có đường truy cập rõ; không tạo thêm dải điều khiển thường trực không cần thiết; scope/view/filter không báo trạng thái mâu thuẫn.                     
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 4 — Form tạo việc an toàn và dùng được bằng bàn phím
                                                                                                                  
Modify: src/components/dashboard/create-task-modal.tsx.                                                           
                                                                                                                  
Tái sử dụng: getInitialTaskFormData, validateTaskForm, focusFirstError, idempotencyKeyRef, handleAssigneeSelect, useVirtualKeyboard, scrollActiveInputIntoView. Dùng confirmation primitive hiện có nếu đáp ứng focus; không cài UI kit mới.                                                                                                          
                                                                                                                  
Hợp đồng đóng form                                                                                                
                                                                                                                  
┌───────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐                                                                                                              
│        Trạng thái         │                              ESC / backdrop / nút X / Hủy                              │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Dropdown con mở           │ ESC đóng dropdown trước, không đóng form                                               │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Form chưa thay đổi        │ Đóng bình thường                                                                       │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Form đã thay đổi          │ Xác nhận “Bỏ nội dung chưa lưu?”; mặc định focus “Tiếp tục nhập”                       │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Đang gửi                  │ Chặn đóng và gửi lặp; hiện “Đang tạo nhiệm vụ…”                                        │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Kết quả gửi chưa xác định │ Giữ nội dung và khóa idempotency; thông báo chưa biết server đã tạo hay chưa; không    │                                                                                                               
│                           │ retry bằng khóa mới                                                                    │                                                                                                               
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Server xác nhận tạo thành │ Đóng/reset như luồng hiện có, không hỏi bỏ nháp                                        │                                                                                                               
│  công                     │                                                                                        │                                                                                                               
└───────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘                                                                                                              
                                                                                                                  
- [ ] Viết test đỏ cho form rỗng, điền rồi hoàn tác, trường nâng cao, prefill từ nhiệm vụ cha, đóng nhầm, chọn giữ nháp và hủy rõ ràng.                                                                                            
- [ ] Chụp snapshot baseline khi mở form với toàn bộ prefill/role normalization. So sánh với snapshot đó, không gọi initializer mỗi render vì hạn mặc định/thông tin cha có thể thay đổi. Dữ liệu mặc định tải muộn chỉ cập nhật field chưa được người dùng chỉnh; không ghi đè nội dung đang nhập hoặc đặt lại dirty baseline sau khi chỉnh sửa.                                                                                                            
- [ ] Đưa mọi đường đóng do người dùng qua một handler; success close tách khỏi discard guard. Không lưu nháp nghiệp vụ vào localStorage trong lượt này.                                                                      
- [ ] Khi validation có lỗi ở trường nâng cao bị ẩn, mở vùng chứa trước rồi focus sau DOM commit. Link trong error summary dùng cùng cơ chế. Sửa các ID focus không khớp input thực tế nếu có.                                     
- [ ] Bổ sung aria-invalid/liên kết mô tả lỗi và nhãn cho trường chọn nhân sự.                                    
- [ ] Enter trong ô tìm nhân sự không submit form. Arrow keys chọn kết quả, Enter chọn mục đang active, Escape đóng và trả focus về trigger; không chọn mục khi đang IME composition hoặc không có kết quả.                    
- [ ] Dùng đúng combobox/listbox/option, aria-controls, aria-expanded và active option nếu giữ custom combobox. Không chỉ thêm ARIA mà thiếu hành vi bàn phím tương ứng.                                                        
- [ ] Chạy test bảo toàn draft, validation, Single DRI và idempotency; không rút bớt trường bắt buộc nghiệp vụ.   
                                                                                                                  
Nghiệm thu: Đóng nhầm không mất nội dung; lỗi luôn dẫn tới trường sửa được; chọn nhân sự không vô tình tạo nhiệm vụ; gửi lỗi/timeout không báo thành công giả.                                                                     
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 5 — Menu Kanban không bị cắt, đổi trạng thái có phản hồi
                                                                                                                  
Modify: src/components/tasks/task-kanban-board.tsx; callback caller trong workspace hoặc expanded view chỉ khi cần trả đúng Promise.                                                                                                 
                                                                                                                  
Tái sử dụng: KANBAN_COLUMNS, mapTaskStatusToKanbanColumn, lifecycle capability hiện có, feedback layer và menu/popover có Portal đang được repo sử dụng.                                                                    
                                                                                                                  
- [ ] Viết test đỏ cho request đang chờ, bấm lặp, request bị reject và pending được dọn sau lỗi.                  
- [ ] Đưa menu ra khỏi ancestor overflow-y-auto bằng menu/Portal có sẵn, có collision handling theo viewport. Không dùng mẹo “thẻ nằm 30% dưới thì mở lên” vì vẫn có thể bị cắt phía trên.                                    
- [ ] Menu hoạt động bằng bàn phím, Escape đóng, trả focus về trigger; click menu không kích hoạt mở chi tiết thẻ. Kiểm tra cả cuộn cột và submenu nếu còn giữ.                                                                    
- [ ] Handler có thể await onStatusChange(...); xác minh caller trả Promise thật, không fire-and-forget. Đặt khóa pending trước khi gửi để chặn click kép.                                                                        
- [ ] Hiện aria-busy, nhãn “Đang cập nhật…” và vô hiệu hóa thao tác trạng thái của đúng task đang xử lý; các task khác vẫn sử dụng được.                                                                                          
- [ ] Giữ đúng optimistic update/rollback hiện có. Không tạo cơ chế optimistic thứ hai; pending cần tồn tại ở nơi không mất khi card chuyển cột và remount.                                                                       
- [ ] Khi lỗi: rollback hoặc giữ trạng thái xác nhận cuối, hiện thông báo tiếng Việt và cho thử lại; không tạo toast trùng từ cả card và caller.                                                                               
- [ ] Test menu ở đầu/cuối cột, cột ngắn, màn hình thấp, mobile; chỉ đưa ra action được lifecycle/role cho phép.  
                                                                                                                  
Nghiệm thu: Không có menu bị clip; một thao tác không gửi hai mutation; thất bại không để lại trạng thái hoàn thành giả hoặc pending bị kẹt.                                                                                    
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 6 — Lịch mobile và trạng thái lọc rõ ràng
                                                                                                                  
Modify:                                                                                                           
- src/components/calendar/calendar-agenda-view.tsx                                                                
- src/components/calendar/create-event-modal.tsx                                                                  
- src/app/calendar/page.tsx                                                                                       
                                                                                                                  
executive-calendar-workspace.tsx chỉ nằm trong diff nếu xác nhận có caller runtime cần sửa; không sửa component không chạy.                                                                                                       
                                                                                                                  
- [ ] Viết regression test cho row tương tác có focus/keyboard, filter reset giữ ngày/kỳ đang xem và chuyển viewport không mất ngày đã chọn.                                                                                
- [ ] Giữ agenda mặc định trên mobile và layout tuần/tháng hiện tại. Không ép rộng week grid, không thêm auto-switch trùng ở nhiều cấp.                                                                                  
- [ ] Nâng TaskRow/EventRow tương tác lên tối thiểu 44px, thêm focus ring không bị overflow cắt; Enter/Space mở đúng task/event, không cuộn trang ngoài ý muốn.                                                                 
- [ ] Input trong modal đạt 16px trên mobile, giữ cỡ desktop hiện tại. Tái sử dụng virtual-keyboard hook nếu cần; không thêm listener trùng.                                                                                      
- [ ] Ngoài popover, hiện tiêu chí lọc đang áp dụng và xóa từng tiêu chí bằng thành phần sẵn có phù hợp. Không ép ActiveFilterBreadcrumb dành riêng nhiệm vụ vào event nếu field/ý nghĩa không khớp.                              
- [ ] “Xóa bộ lọc” giữ ngày/kỳ và scope hợp lệ; trạng thái rỗng nói rõ do lọc hay do ngày đó chưa có lịch.        
- [ ] Kiểm tra form khi bàn phím mở: input và nút lưu còn tiếp cận được, không vô hiệu hóa pinch zoom. iOS auto-zoom phải kiểm tra bằng Safari/thiết bị thật nếu có; Chromium viewport nhỏ không chứng minh được.          
                                                                                                                  
Nghiệm thu: Lịch mobile vẫn theo agenda; thao tác chạm/focus rõ; người dùng biết mình đang xem lịch đã lọc; không thay đổi UTC+7 hoặc chu kỳ tháng.                                                                                 
                                                                                                                  
---                                                                                                               
                                                                                                                  
## Task 7 — Kiểm chứng, review và bàn giao
                                                                                                                  
Tests                                                                                                             
                                                                                                                  
- [ ] Mở rộng test hiện có theo module khi file thực sự tồn tại. Gom regression liên luồng mới vào tests/ux-interactions-regression.test.ts, dùng Node test runner hiện có; không thêm framework.                  
- [ ] Test phải gọi logic/handler thực tế hoặc tương tác component; không sao chép nguyên logic production vào test rồi assert bản sao.                                                                                        
- [ ] Kiểm tra source/SSR chỉ dùng cho wiring/semantics, không thay kiểm tra focus, history, pending hay clipping trong browser.                                                                                                  
                                                                                                                  
node scripts/run-tests.mjs --files tests/ux-interactions-regression.test.ts tests/task-table-engine.test.ts tests/role-pages-integration.test.ts tests/content-terminology.test.ts                                            
npm run typecheck                                                                                                 
npm run lint                                                                                                      
npm test                                                                                                          
git diff --check                                                                                                  
                                                                                                                  
tests/ux-interactions-regression.test.ts là file được tạo trong quá trình triển khai, không phải file được khẳng định đã tồn tại. Chạy thêm các test form/Kanban/calendar đã xác nhận có trong repo. Ghi rõ lệnh, số pass/fail và output lỗi.                                                                                                       
                                                                                                                  
Browser acceptance                                                                                                
                                                                                                                  
┌─────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────┐                                                                                                              
│    Luồng    │                                       Các bước cần chứng minh                                        │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Lọc         │ Chờ duyệt → Quá hạn → Tất cả; URL, selected, count và dữ liệu đúng                                   │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Ngữ cảnh    │ Chọn preset → đổi một tiêu chí → mở chi tiết → Back → reload; không hiển thị preset cũ sai           │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Empty state │ Tìm từ khóa không có → xóa lọc tại vùng rỗng → danh sách trở lại, kỳ/scope giữ nguyên                │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Draft       │ Điền nội dung → ESC/backdrop/X → tiếp tục nhập hoặc xác nhận bỏ; không mất nháp ngầm                 │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Validation  │ Ẩn trường nâng cao đang lỗi → submit → vùng mở và focus đúng field                                   │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Kanban      │ Card cuối cột → mở menu → đổi trạng thái dưới mạng chậm → không gửi lặp; lỗi trả lại trạng thái đúng │                                                                                                            
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Mobile lịch │ 375px, agenda → lọc → xóa lọc → tạo event → mở bàn phím; không tràn ngang body                       │                                                                                                               
├─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────┤                                                                                                              
│ Phân quyền  │ Đại diện BGH, trưởng đơn vị và nhân viên; không hiện/cho thực thi thao tác vượt quyền                │                                                                                                               
└─────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────┘                                                                                                              
                                                                                                                  
- [ ] Chụp một lượt desktop/mobile sau sửa, sửa lỗi thấy được trong một batch, kiểm tra xác nhận tối đa một lượt nữa.                                                                                                            
- [ ] Reviewer độc lập đọc diff so với baseline WIP, kiểm tra spec và correctness; không buộc worker đọc lại toàn bộ lịch sử hội thoại.                                                                                           
- [ ] Chỉ sửa regression do lượt này gây ra. Lỗi baseline thiếu agent config hoặc môi trường được liệt kê riêng, không sửa để làm đẹp số test.                                                                                   
- [ ] Bàn giao danh sách file thay đổi, test đã chạy, browser đã kiểm tra/chưa kiểm tra và vấn đề còn lại. Không tuyên bố “toàn bộ UX đạt chuẩn WCAG” chỉ từ các kiểm tra trên.                                                  
                                                                                                                  
Thứ tự thực thi bằng workflow                                                                                     
                                                                                                                  
Baseline                                                                                                          
## Task 2: URL, filter, empty state → Task 3: toolbar
## Task 4: form → Task 5: Kanban → Task 6: calendar
## Task 7: integration, browser, review cuối
                                                                                                                  
- Mỗi task có implementer, test và review riêng; không lặp lại khảo sát tổng thể.                                 
- Cùng working tree: chỉ một implementer ghi file tại một thời điểm. Review chỉ đọc có thể chạy song song với task không chung file/interface.                                                                                     
- Không để Task 3 và Task 5 sửa unified-adaptive-workspace.tsx đồng thời.                                         
- Lưu task thực sự hoàn thành cùng bằng chứng trong ledger; task đã có diff/test hợp lệ thì tiếp tục từ đó, không chạy lại vì mất context.                                                                                        
- Chỉ bắt đầu sửa ứng dụng khi người dùng duyệt plan này.                                                         
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
