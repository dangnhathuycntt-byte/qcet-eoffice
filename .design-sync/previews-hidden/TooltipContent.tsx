import React from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from 'qcet-eoffice';

export function Default() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm">Nút có tooltip</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Chú giải TooltipContent</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
