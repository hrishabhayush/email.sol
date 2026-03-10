import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusConfig, type EmailStatus } from '@/lib/email-status';
import { cn } from '@/lib/utils';
import { memo } from 'react';

interface StatusTagProps {
  status: EmailStatus;
  folder: string;
  className?: string;
}

export const StatusTag = memo(function StatusTag({ status, folder, className }: StatusTagProps) {
  if (!status) return null;

  const config = getStatusConfig(status, folder);
  if (!config) return null;

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
});
