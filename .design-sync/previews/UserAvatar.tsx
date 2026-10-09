import React from "react";
import { UserAvatar, UserAvatarGroup } from "qcet-eoffice";

export function Default() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      <UserAvatar name="Nguyễn Văn An" size="sm" />
      <UserAvatar name="Trần Thị Bình" size="md" />
      <UserAvatar name="Lê Hoàng Cúc" size="lg" />
      <UserAvatar name="Đặng Nhật Huy" size="xl" />
    </div>
  );
}

export function Group() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <UserAvatarGroup
        users={[
          { name: "Đặng Nhật Huy" },
          { name: "Nguyễn Thị Hồng Trinh" },
          { name: "Ngô Lê Minh Khuê" },
          { name: "Nguyễn Ngọc Vinh" },
          { name: "Lê Minh Khoa" },
        ]}
        max={3}
        size="sm"
      />
      <UserAvatarGroup
        users={[
          { name: "Đặng Nhật Huy" },
          { name: "Nguyễn Thị Hồng Trinh" },
          { name: "Ngô Lê Minh Khuê" },
        ]}
        max={3}
        size="md"
      />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      <UserAvatar name="Admin" size="xs" />
      <UserAvatar name="Bảng nhiệm vụ" size="sm" />
      <UserAvatar name="Hoạt động" size="md" />
      <UserAvatar name="Hồ sơ cá nhân" size="lg" />
      <UserAvatar name="Onboarding" size="xl" />
    </div>
  );
}
