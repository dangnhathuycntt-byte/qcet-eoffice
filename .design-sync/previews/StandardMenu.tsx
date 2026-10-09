import React from 'react';
import { Button, StandardMenu } from 'qcet-eoffice';

export function Default() {
  return (
    <StandardMenu
      trigger={<Button variant="secondary" size="sm">Tùy chọn menu</Button>}
      items={[
        { id: '1', label: 'Xem chi tiết' },
        { id: '2', label: 'Đổi trạng thái' },
        { id: '3', label: 'Giao lại nhiệm vụ' },
        { id: '4', label: 'Hủy nhiệm vụ', destructive: true, separator: true }
      ]}
    />
  );
}
