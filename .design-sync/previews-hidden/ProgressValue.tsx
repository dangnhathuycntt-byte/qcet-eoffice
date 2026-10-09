import React from 'react';
import { Progress, ProgressTrack, ProgressIndicator, ProgressValue } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-72">
      <Progress value={90}>
        <div className="flex justify-end text-xs font-medium mb-1 tabular-nums">
          <ProgressValue>90%</ProgressValue>
        </div>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
