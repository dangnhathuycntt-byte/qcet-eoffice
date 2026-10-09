import React from 'react';
import { FeedbackProvider, Button } from 'qcet-eoffice';

export function Default() {
  return (
    <FeedbackProvider>
      <div className="p-3 text-xs text-muted-foreground">
        FeedbackProvider cung cấp context và Toaster cho toàn ứng dụng.
      </div>
    </FeedbackProvider>
  );
}
