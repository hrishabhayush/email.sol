import { getBadgeStatus, type EmailStatus } from '@/lib/email-status';
import { cn } from '@/lib/utils';
import { memo } from 'react';

interface BadgeIconProps {
  status: EmailStatus;
  folder: string;
  className?: string;
}

export const BadgeIcon = memo(function BadgeIcon({ status, folder, className }: BadgeIconProps) {
  if (!status) return null;

  const badgeStatus = getBadgeStatus(status, folder);
  if (!badgeStatus || !badgeStatus.icon) return null;

  const isAttemptsRemaining = badgeStatus.attemptsCount !== undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm',
        isAttemptsRemaining && 'font-medium text-red-600 dark:text-red-400',
        className,
      )}
      title={badgeStatus.label}
    >
      <span className="text-base leading-none">{badgeStatus.icon}</span>
      {isAttemptsRemaining && (
        <span className="text-xs font-semibold">{badgeStatus.attemptsCount}</span>
      )}
    </span>
  );
});
