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
import { signIn } from '@/lib/auth-client';
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export const SignInDialog = ({
  children,
  className,
  onOpenChange,
}: {
  children?: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) => {
  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>Select an email provider to sign in</DialogDescription>
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
                  onClick={async () => {
                    toast.promise(
                      signIn.social({
                        provider: provider.providerId as any,
                        callbackURL: `${window.location.origin}/mail`,
                      }),
                      {
                        error: 'Login redirect failed',
                      },
                    );
                  }}
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
