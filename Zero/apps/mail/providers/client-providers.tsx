import { useKeyboardLayout } from '@/components/keyboard-layout-indicator';
import { LoadingProvider } from '@/components/context/loading-context';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PostHogProvider } from '@/lib/posthog-provider';
import { useSettings } from '@/hooks/use-settings';
import { Provider as JotaiProvider } from 'jotai';
import type { PropsWithChildren } from 'react';
import Toaster from '@/components/ui/toast';
import { ThemeProvider } from 'next-themes';
import { SolanaWalletProvider } from './wallet-provider';

export function ClientProviders({ children }: PropsWithChildren) {
  const { data } = useSettings();
  useKeyboardLayout();

  return (
    <NuqsAdapter>
      <JotaiProvider>
        <SolanaWalletProvider>
          <ThemeProvider
            attribute="class"
            enableSystem={false}
            disableTransitionOnChange
            defaultTheme="dark"
            forcedTheme="dark"
          >
            <SidebarProvider>
              <PostHogProvider>
                <LoadingProvider>
                  {children}
                  <Toaster />
                </LoadingProvider>
              </PostHogProvider>
            </SidebarProvider>
          </ThemeProvider>
        </SolanaWalletProvider>
      </JotaiProvider>
    </NuqsAdapter>
  );
}
