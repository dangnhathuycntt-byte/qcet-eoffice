import React from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from 'qcet-eoffice';

export function Default() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm">Rê chuột vào đây</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Nội dung TooltipTrigger</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
