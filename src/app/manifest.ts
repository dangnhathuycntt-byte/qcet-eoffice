import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử",
    short_name: "QCET E-Office",
    description:
      "Hệ thống Quản lý và Điều hành Công việc Điện tử - Trường Cao đẳng Kỹ thuật Quy Nhơn (QCET)",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fbfbfb",
    theme_color: "#fbfbfb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Tạo việc mới",
        short_name: "Tạo việc",
        description: "Mở nhanh hộp thoại tạo nhiệm vụ mới",
        url: "/?action=create_task",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Việc cần xử lý",
        short_name: "Cần xử lý",
        description: "Truy cập danh sách công việc cần xử lý",
        url: "/?zone=tasks&filter=needs_review",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lịch công tác",
        short_name: "Lịch",
        description: "Xem lịch công tác tuần và tháng",
        url: "/?zone=calendar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
