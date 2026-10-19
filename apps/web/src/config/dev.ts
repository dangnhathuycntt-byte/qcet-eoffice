/**
 * Công cụ chỉ dành cho `next dev` (vd. đăng nhập thử theo vai trò). Next thay `process.env.NODE_ENV` lúc build,
 * nên ở bản production hằng này là `false` và phần mã bọc bởi nó bị loại khỏi bundle.
 */
export const IS_DEV_TOOLS_ENABLED = process.env.NODE_ENV === "development";
