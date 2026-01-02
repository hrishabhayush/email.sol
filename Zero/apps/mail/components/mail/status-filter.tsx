import { useMemo } from 'react';
import { useQueryState } from 'nuqs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { getStatusFilters, getStatusConfig, type EmailStatus } from '@/lib/email-status';
import { cn } from '@/lib/utils';
import { FOLDERS } from '@/lib/utils';

interface StatusFilterProps {
  folder: string;
  className?: string;
}

export function StatusFilter({ folder, className }: StatusFilterProps) {
  const [statusFilter, setStatusFilter] = useQueryState<EmailStatus | 'all'>('status', {
    defaultValue: 'all',
    parse: (value) => {
      if (value === 'all' || !value) return 'all';
      return value as EmailStatus;
    },
    serialize: (value) => value === 'all' ? '' : value || '',
  });

  const statusFilters = useMemo(() => {
    const filters = getStatusFilters(folder || 'inbox');
    return filters;
  }, [folder]);
  
  // Normalize folder - handle both 'inbox' and undefined as inbox
  const normalizedFolder = folder || 'inbox';
  const shouldShowFilter = normalizedFolder === FOLDERS.SENT || normalizedFolder === FOLDERS.INBOX || !folder;

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[StatusFilter]', {
      folder,
      normalizedFolder,
      shouldShowFilter,
      statusFiltersCount: statusFilters.length,
      statusFilters: statusFilters.map(s => s.id),
    });
  }

  if (!shouldShowFilter || statusFilters.length === 0) {
    return null;
  }

  const currentConfig = statusFilter && statusFilter !== 'all' 
    ? getStatusConfig(statusFilter, folder)
    : null;

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
          className={cn(
            'cursor-pointer',
            statusFilter === 'all' && 'bg-primary/10',
          )}
        >
          All Status
        </DropdownMenuItem>
        {statusFilters.map((status) => (
          <DropdownMenuItem
            key={status.id}
            onClick={() => setStatusFilter(status.id as EmailStatus)}
            className={cn(
              'cursor-pointer',
              statusFilter === status.id && 'bg-primary/10',
            )}
          >
            <div className="flex items-center gap-2">
              {status.icon && <span>{status.icon}</span>}
              <span>{status.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

