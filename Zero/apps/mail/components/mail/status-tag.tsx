import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusConfig, type EmailStatus } from '@/lib/email-status';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatusTagProps {
  status: EmailStatus;
  folder: string;
  className?: string;
}

export const StatusTag = memo(function StatusTag({ status, folder, className }: StatusTagProps) {
  if (!status) return null;

  const config = getStatusConfig(status, folder);
  if (!config) return null;
  if (config.id == 'attempts_remaining_1') {
    //TODO: enable button to see recs
    /* One button for both the tooltip trigger & the pop up trigger
    * hover -> tooltip shows
    * click -> pop up shows 
    */
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">{config.label}</Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">Click to see improvement suggestions</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="top" className="w-72 p-3" align="start">
          <p className="text-sm font-medium mb-2">Suggestions</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {"hihuguigiugiugugu"}
          </ul>
        </PopoverContent>
      </Popover>
    );
  } else {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
              config.color,
              config.bgColor,
              className,
            )}
          >
            {config.icon && <span>{config.icon}</span>}
            <span>{config.label}</span>
          </span>
        </TooltipTrigger>
        {config.description && (
          <TooltipContent className="z-50 max-w-xs" side="top">
            <p className="text-xs">{config.description}</p>
          </TooltipContent>
        )}
      </Tooltip>
    );
  }
});

