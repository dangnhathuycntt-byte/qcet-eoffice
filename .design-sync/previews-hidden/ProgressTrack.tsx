import React from 'react';
import { Progress, ProgressTrack, ProgressIndicator } from 'qcet-eoffice';

export function Default() {
  return (
    <div className="w-72">
      <Progress value={45}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    </div>
  );
}
