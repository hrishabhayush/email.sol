'use client';

/**
 * Privy auth provider and login context for the mail app.
 * Wraps the app with Privy (email + wallet login, Solana embedded wallets)
 * and exposes a login callback via context for use after auth flows complete.
 */

import { PrivyProvider as PrivyProviderBase, useLogin, usePrivy, useWallets } from '@privy-io/react-auth';
import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from 'react';

/** Context providing the Privy login function so children can trigger login from outside the auth UI. */
export const PrivyLoginContext = createContext<{ login: () => void }>({
  login: () => {},
});

/** Injects the Privy `useLogin()` result into context so it can be consumed by usePrivyLoginOnComplete. 
 * Provider component for the PrivyLoginContext.
*/
function PrivyLoginContextProvider({ children }: PropsWithChildren) {
  const { login } = useLogin();
  const value = useMemo(() => ({ login }), [login]);
  return (
    <PrivyLoginContext.Provider value={value}>{children}</PrivyLoginContext.Provider>
  );
}

/**
 * Returns a stable callback that opens the Privy login flow.
 * Use this after completing a flow to prompt the user to log in with Privy.
 * 
 * Purpose: Consumer API for “trigger login from here.”
 * @returns A function that invokes the Privy login from @privy-io/react-auth.
 */
export function usePrivyLoginOnComplete(): () => void {
  const { login } = useContext(PrivyLoginContext);
  return useCallback(() => {
    login();
  }, [login]);
}

/**
 * Root Privy provider: email + wallet login, Solana embedded wallets for users without wallets.
 * Requires VITE_PRIVY_APP_ID in env; if missing, renders children with a no-op login context.
 */
export function PrivyProvider({ children }: PropsWithChildren) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

  // Basic runtime visibility into Privy configuration.
  // eslint-disable-next-line no-console
  console.log('[PrivyProvider] render', {
    appIdPresent: !!appId,
    appIdPreview: appId ? `${appId.slice(0, 4)}…${appId.slice(-4)}` : null,
    dev: import.meta.env.DEV,
  });

  /** Static config for Privy; computed once on mount to avoid unnecessary re-initialization. */
  const config = useMemo(
    () => ({
      loginMethods: ['email', 'wallet'] as const,
      embeddedWallets: {
        solana: {
          createOnLogin: 'users-without-wallets' as const,
        },
      },
      appearance: {
        walletList: ['detected', 'phantom', 'solflare', 'torus'],
      },
    }),
    [],
  );

  if (!appId || typeof appId !== 'string' || appId.trim() === '') {
    //get a function that does nothing, instead of throwing an error
    return (
      <PrivyLoginContext.Provider value={{ login: () => {} }}>
        {children}
      </PrivyLoginContext.Provider>
    );
  }

  return (
    <PrivyProviderBase appId={appId} config={config}>
      <PrivyLoginContextProvider>{children}</PrivyLoginContextProvider>
    </PrivyProviderBase>
  );
}

/**
 * Dev-only login popup / debug hook to Privy.
 */
export function PrivyDebugPanel() {
  // eslint-disable-next-line no-console
  console.log('[PrivyDebugPanel] render start', { dev: import.meta.env.DEV });

  if (!import.meta.env.DEV) return null;

  const { user, ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // eslint-disable-next-line no-console
  console.log('[PrivyDebugPanel] privy state', {
    ready,
    authenticated,
    userId: user?.id,
    email: user?.email?.address,
    walletCount: wallets.length,
  });

  if (!ready) {
    return null;
  }

  // If already authenticated, no popup needed.
  if (authenticated) {
    return null;
  }

  // Full-screen, high z-index popup with a clear login button.
  return (
    <div
      style={{ display: 'block' }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40"
    >
      <div
        style={{ display: 'block' }}
        className="rounded-lg bg-background px-8 py-6 text-center shadow-2xl"
      >
        <h2 className="mb-3 text-lg font-semibold">Sign in with Privy</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Continue to connect your email and embedded Solana wallet.
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Log in with Privy
        </button>
      </div>
    </div>
  );
}
