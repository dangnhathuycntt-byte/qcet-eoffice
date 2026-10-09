import React from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from 'qcet-eoffice';

export function Default() {
  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm">TooltipProvider demo</Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tooltip trong Provider</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
