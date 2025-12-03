import { createAuthClient } from 'better-auth/client';

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_PUBLIC_BACKEND_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [],
});

export const authProxy = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      try {
        // Add timeout to prevent hanging indefinitely
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 5000);
        });

        const sessionPromise = authClient.getSession({
          fetchOptions: { headers, credentials: 'include' },
        }).then((session) => {
          if (session.error) {
            console.error(`Failed to get session: ${session.error}`, session);
            return null;
          }
          return session.data;
        });

        return Promise.race([sessionPromise, timeoutPromise]);
      } catch (error) {
        console.error('Error getting session:', error);
        return null;
      }
    },
  },
};
