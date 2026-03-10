import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getStatusFilters,
  getStatusConfig,
  type EmailStatus,
  isAttemptsRemainingStatus,
} from '@/lib/email-status';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { FOLDERS } from '@/lib/utils';
import { useQueryState } from 'nuqs';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface StatusFilterProps {
  folder: string;
  className?: string;
}

export function StatusFilter({ folder, className }: StatusFilterProps) {
  const [statusFilter, setStatusFilter] = useQueryState<EmailStatus | 'all' | 'attempts_remaining'>(
    'status',
    {
      defaultValue: 'all',
      parse: (value) => {
        if (value === 'all' || !value) return 'all';
        if (value === 'attempts_remaining') return 'attempts_remaining';
        return value as EmailStatus;
      },
      serialize: (value) => (value === 'all' ? '' : value || ''),
    },
  );

  const statusFilters = useMemo(() => {
    const filters = getStatusFilters(folder || 'inbox');
    return filters;
  }, [folder]);

  // Normalize folder - handle both 'inbox' and undefined as inbox
  const normalizedFolder = folder || 'inbox';
  const shouldShowFilter =
    normalizedFolder === FOLDERS.SENT || normalizedFolder === FOLDERS.INBOX || !folder;

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[StatusFilter]', {
      folder,
      normalizedFolder,
      shouldShowFilter,
      statusFiltersCount: statusFilters.length,
      statusFilters: statusFilters.map((s) => s.id),
    });
  }

  if (!shouldShowFilter || statusFilters.length === 0) {
    return null;
  }

  // Handle attempts_remaining filter (combines all attempts_remaining states)
  const currentConfig = useMemo(() => {
    if (!statusFilter || statusFilter === 'all') return null;

    // If filter is 'attempts_remaining', return the combined config
    if (statusFilter === 'attempts_remaining') {
      return {
        id: 'attempts_remaining',
        label: 'Attempts Remaining',
        color: 'text-red-700 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: '❌',
        badgeIcon: '❌',
        description: 'Has attempts remaining (2, 1, or 0)',
      };
    }

    return getStatusConfig(statusFilter, folder);
  }, [statusFilter, folder]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'text-muted-foreground flex h-8 min-w-fit items-center gap-1 rounded-md border-none px-2',
            className,
          )}
          aria-label="Filter by status"
        >
          <span className="text-xs font-medium">
            {currentConfig ? currentConfig.label : 'All Status'}
          </span>
          <ChevronDown className="h-2 w-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-muted w-48 font-medium dark:bg-[#2C2C2C]"
        align="start"
        role="menu"
        aria-label="Status filter options"
      >
        <DropdownMenuItem
          onClick={() => setStatusFilter('all')}
          className={cn('cursor-pointer', statusFilter === 'all' && 'bg-primary/10')}
        >
          All Status
        </DropdownMenuItem>
        {statusFilters.map((status) => {
          // Check if current filter matches this status or if it's an attempts_remaining status
          const isSelected =
            statusFilter === status.id ||
            (status.id === 'attempts_remaining' &&
              statusFilter &&
              isAttemptsRemainingStatus(statusFilter as EmailStatus));

          return (
            <DropdownMenuItem
              key={status.id}
              onClick={() => {
                // For attempts_remaining filter, we need to handle it specially
                // The filter value should be 'attempts_remaining' but we need to match any attempts_remaining status
                if (status.id === 'attempts_remaining') {
                  setStatusFilter('attempts_remaining');
                } else {
                  setStatusFilter(status.id as EmailStatus);
                }
              }}
              className={cn('cursor-pointer', isSelected && 'bg-primary/10')}
            >
              <div className="flex items-center gap-2">
                {(status.badgeIcon || status.icon) && (
                  <span>{status.badgeIcon || status.icon}</span>
                )}
                <span>{status.label}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
