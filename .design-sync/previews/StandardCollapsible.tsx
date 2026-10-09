import React from 'react';
import { StandardCollapsible } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-80">
      <StandardCollapsible title="Việc con (1/3)" defaultOpen>
        <div className="p-2.5 bg-secondary rounded-xl text-xs space-y-1 mt-1.5">
          <div>• Thu thập số liệu 6 phòng</div>
          <div>• Soạn báo cáo tổng hợp</div>
        </div>
      </StandardCollapsible>
    </div>
  );
}
