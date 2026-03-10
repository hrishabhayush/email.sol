import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '../ui/dialog';
import { emailProviders } from '@/lib/constants';
import { authClient } from '@/lib/auth-client';
import { useLocation } from 'react-router';
import { UserPlus, X } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export const AddConnectionDialog = ({
  children,
  className,
  onOpenChange,
}: {
  children?: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const pathname = useLocation().pathname;

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button
            size={'dropdownItem'}
            variant={'dropdownItem'}
            className={cn('w-full justify-start gap-2', className)}
          >
            <UserPlus size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
            <p className="text-[13px] opacity-60">{m['pages.settings.connections.addEmail']()}</p>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent showOverlay={true}>
        <DialogClose asChild>
          <button
            className="absolute right-4 top-4 z-10 cursor-pointer border-0 bg-transparent p-0 focus:outline-none"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogClose>
        <DialogHeader className="text-center sm:!text-center">
          <DialogTitle>{m['pages.settings.connections.connectEmail']()}</DialogTitle>
          <DialogDescription>
            {m['pages.settings.connections.connectEmailDescription']()}
          </DialogDescription>
        </DialogHeader>
        <motion.div
          className="mt-4 grid grid-cols-2 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {emailProviders.map((provider, index) => {
            const Icon = provider.icon;
            return (
              <motion.div
                key={provider.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  className="h-24 w-full cursor-pointer flex-col items-center justify-center gap-2"
                  onClick={async () =>
                    await authClient.linkSocial({
                      provider: provider.providerId,
                      callbackURL: `${window.location.origin}${pathname}`,
                    })
                  }
                >
                  <Icon className="size-6!" />
                  <span className="text-xs">{provider.name}</span>
                </Button>
              </motion.div>
            );
          })}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
