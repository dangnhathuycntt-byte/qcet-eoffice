import { NodeIdPlugin } from "platejs";

/**
 * NodeIdPlugin cho editor cùng sửa (ADR-014). Plate gắn plugin theo priority giảm dần (bằng nhau thì theo thứ tự khai báo, plugin
 * lõi trước): YjsPlugin (100, khai báo sau) bọc ngoài NodeIdPlugin nên `withYjs` ghi thao tác vào tài liệu trước khi NodeId đổi
 * `id` của khối vừa tách. Hậu quả: tài liệu Yjs có `id` trùng, và mỗi máy tự gán một `id` khác khi nhận thao tác từ xa.
 * Hạ priority để NodeId gắn sau cùng, bọc ngoài `withYjs`: thao tác đã có `id` mới mới tới Yjs. Không đẩy YjsPlugin lên trước
 * vì HistoryPlugin lõi gắn sau sẽ đè hoàn tác của Yjs.
 */
export const collabNodeIdPlugin = NodeIdPlugin.configure({ priority: 50 });
