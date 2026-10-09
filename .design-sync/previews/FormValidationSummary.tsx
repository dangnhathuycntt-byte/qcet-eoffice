import React from 'react';
import { FormValidationSummary } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-80">
      <FormValidationSummary
        title="Có 2 lỗi cần chỉnh sửa"
        errors={[
          'Vui lòng nhập tên nhiệm vụ',
          'Hạn hoàn thành không được trước ngày bắt đầu'
        ]}
      />
    </div>
  );
}
