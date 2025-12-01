import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaWalletProvider({ children }: PropsWithChildren) {
  // Don't render wallet provider on server
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/3GHuEu4-cXEuE8jDAZW3EFgTedkyJ0K3';
    
    // Ensure the URL is valid and starts with http:// or https://
    if (!rpcUrl || (typeof rpcUrl === 'string' && !rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://'))) {
      console.warn('Invalid RPC URL, using default:', rpcUrl);
      return 'https://solana-mainnet.g.alchemy.com/v2/3GHuEu4-cXEuE8jDAZW3EFgTedkyJ0K3';
    }
    
    return rpcUrl;
  }, []);

  // Initialize wallets - using empty array like the reference, wallets will be detected automatically
  // Or you can explicitly provide wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

