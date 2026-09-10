import type { MetadataRoute } from "next";
import { INSTITUTION_CONFIG } from "@/config/institution";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${INSTITUTION_CONFIG.shortName} E-Office - ${INSTITUTION_CONFIG.abbreviatedName}`,
    short_name: `${INSTITUTION_CONFIG.shortName} E-Office`,
    description: `Hệ thống quản lý điều hành tác nghiệp và hành chính điện tử ${INSTITUTION_CONFIG.shortName}`,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "vi",
    dir: "ltr",
    categories: ["productivity", "education", "business"],
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nhiệm vụ",
        short_name: "Nhiệm vụ",
        description: "Truy cập nhanh danh sách nhiệm vụ và điều hành công việc",
        url: "/tasks",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Văn bản",
        short_name: "Văn bản",
        description: "Tra cứu và xử lý văn bản hành chính",
        url: "/documents",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lịch công tác",
        short_name: "Lịch",
        description: "Xem lịch công tác tuần và sự kiện nhà trường",
        url: "/calendar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Tạo việc mới",
        short_name: "Tạo việc",
        description: "Mở nhanh hộp thoại tạo nhiệm vụ mới",
        url: "/?action=create_task",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
