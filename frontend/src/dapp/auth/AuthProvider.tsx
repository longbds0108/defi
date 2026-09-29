import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { WagmiProvider as PrivyWagmiProvider, createConfig as createPrivyConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fallback, http } from 'viem';
import { WagmiProvider, createConfig, useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { ARC_RPCS, arcTestnet } from '../chains';

export type AuthMethod = 'google' | 'wallet';

export interface AuthState {
  ready: boolean;
  connected: boolean;
  address?: `0x${string}`;
  method: AuthMethod | null;
  /** Google email when signed in with Google. */
  email?: string;
  /** False when no Privy app id is configured; the UI explains how to enable it. */
  googleEnabled: boolean;
  loginWithGoogle: () => void;
  connectWallet: () => void;
  logout: () => Promise<void>;
  error?: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

const PRIVY_APP_ID: string | undefined = import.meta.env.VITE_PRIVY_APP_ID || undefined;
const transport = fallback(ARC_RPCS.map((url) => http(url)));
const privyWagmiConfig = PRIVY_APP_ID
  ? createPrivyConfig({ ssr: true, chains: [arcTestnet], transports: { [arcTestnet.id]: transport } })
  : null;
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

/// Privy handles both "Connect Google" (embedded wallet created on first
/// login) and "Connect wallet" (MetaMask, Rabby, WalletConnect…). Without a
/// VITE_PRIVY_APP_ID the app falls back to browser wallets via wagmi's
/// injected connector, and the Google button explains what is missing.
export function AuthProvider({ children }: { children: ReactNode }) {
  if (PRIVY_APP_ID && privyWagmiConfig) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['google', 'wallet'],
          appearance: { theme: '#0E0B14', accentColor: '#9B5DE5', walletChainType: 'ethereum-only' },
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          defaultChain: arcTestnet,
          supportedChains: [arcTestnet],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <PrivyAuthBridge>{children}</PrivyAuthBridge>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  return (
    <WagmiProvider config={injectedConfig}>
      <QueryClientProvider client={queryClient}>
        <InjectedAuthBridge>{children}</InjectedAuthBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { address } = useAccount();
  const walletAddress = (address ?? user?.wallet?.address) as `0x${string}` | undefined;

  const value = useMemo<AuthState>(
    () => ({
      ready,
      connected: ready && authenticated && Boolean(walletAddress),
      address: walletAddress,
      method: user?.google ? 'google' : user?.wallet ? 'wallet' : null,
      email: user?.google?.email,
      googleEnabled: true,
      loginWithGoogle: () => login({ loginMethods: ['google'] }),
      connectWallet: () => login({ loginMethods: ['wallet'] }),
      logout,
    }),
    [ready, authenticated, walletAddress, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// `ssr: true` makes wagmi hydrate from an effect instead of during render,
// which avoids React's "setState while rendering another component" warning.
const injectedConfig = createConfig({
  ssr: true,
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: transport },
});

function InjectedAuthBridge({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAccount();
  const { connect, connectors, error } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const value = useMemo<AuthState>(
    () => ({
      ready: status !== 'reconnecting',
      connected: isConnected && Boolean(address),
      address,
      method: isConnected ? 'wallet' : null,
      googleEnabled: false,
      loginWithGoogle: () => undefined,
      connectWallet: () => {
        const connector = connectors[0];
        if (connector) connect({ connector, chainId: arcTestnet.id });
      },
      logout: async () => {
        await disconnectAsync();
      },
      error: error
        ? /provider not found|no provider/i.test(error.message)
          ? 'No browser wallet found. Install MetaMask or Rabby, then try again.'
          : error.message.split('\n')[0]
        : undefined,
    }),
    [address, isConnected, status, connect, connectors, disconnectAsync, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
