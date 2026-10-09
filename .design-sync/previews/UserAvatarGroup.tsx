import React from 'react';
import { UserAvatarGroup } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="flex flex-col gap-3">
      <UserAvatarGroup
        users={[
          { name: 'Đặng Nhật Huy' },
          { name: 'Nguyễn Thị Hồng Trinh' },
          { name: 'Ngô Lê Minh Khuê' },
          { name: 'Nguyễn Ngọc Vinh' },
          { name: 'Lê Minh Khoa' }
        ]}
        max={3}
        size="sm"
      />
      <UserAvatarGroup
        users={[
          { name: 'Đặng Nhật Huy' },
          { name: 'Nguyễn Thị Hồng Trinh' },
          { name: 'Ngô Lê Minh Khuê' }
        ]}
        max={3}
        size="md"
      />
    </div>
  );
}
