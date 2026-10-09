import React from 'react';
import { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-72">
      <Progress value={80}>
        <div className="flex justify-between text-xs font-medium mb-1.5">
          <ProgressLabel>Tiến độ nhiệm vụ</ProgressLabel>
          <ProgressValue>80%</ProgressValue>
        </div>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
