import { phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { Auth } from '@zero/server/auth';

const backendURL = import.meta.env.VITE_PUBLIC_BACKEND_URL || 'http://localhost:8787';

export const authClient = createAuthClient({
  baseURL: backendURL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, $fetch } = authClient;
export type Session = Awaited<ReturnType<Auth['api']['getSession']>>;
