import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusConfig, type EmailStatus } from '@/lib/email-status';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StatusTagProps {
  status: EmailStatus;
  folder: string;
  className?: string;
  /** From scoring result; shown in popover for attempts remaining. */
  recommendations?: string[];
}

export const StatusTag = memo(function StatusTag({
  status,
  folder,
  className,
  recommendations = [],
}: StatusTagProps) {
  if (!status) return null;

  const config = getStatusConfig(status, folder);
  if (!config) return null;
  const showRecommendationsPopover =
    config.id === 'attempts_remaining_1';
  if (showRecommendationsPopover) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
                  config.color,
                  config.bgColor,
                  className,
                )}
              >
                {config.icon && <span>{config.icon}</span>}
                <span>{config.label}</span>
              </span>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">Click to see improvement suggestions</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="top" className="w-[36rem] max-w-[calc(100vw-2rem)] p-3" align="start">
          <p className="text-sm font-medium mb-2">Suggestions</p>
          <ul className="list-disc list-inside space-y-1.5 pl-4 text-sm text-muted-foreground">
            {recommendations.length > 0 ? (
              recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))
            ) : (
              <li className="text-muted-foreground/70">No suggestions available.</li>
            )}
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

