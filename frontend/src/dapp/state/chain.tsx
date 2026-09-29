import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CHAINS, DEFAULT_CHAIN_ID, chainById, type ChainConfig } from '../chains';

interface ChainState {
  config: ChainConfig;
  chainId: number;
  setChainId: (id: number) => void;
  /** True when a wallet is connected on a different chain than the one selected. */
  wrongNetwork: boolean;
  /** Switches the wallet to `id` (defaults to the selected chain) and resolves when done. */
  ensureChain: (id?: number) => Promise<void>;
}

const ChainContext = createContext<ChainState | null>(null);
const STORAGE_KEY = 'lumora.chain';

function readStoredChain() {
  try {
    const id = Number(localStorage.getItem(STORAGE_KEY));
    return CHAINS.some((c) => c.chain.id === id) ? id : DEFAULT_CHAIN_ID;
  } catch {
    return DEFAULT_CHAIN_ID;
  }
}

/// The chain the app is showing. Independent of the wallet so the app can be
/// browsed before connecting; actions call ensureChain() before signing.
export function ChainProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainIdState] = useState(readStoredChain);
  const { chainId: walletChainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const setChainId = useCallback((id: number) => {
    setChainIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, []);

  const ensureChain = useCallback(
    async (id = chainId) => {
      if (isConnected && walletChainId !== id) await switchChainAsync({ chainId: id });
    },
    [chainId, isConnected, walletChainId, switchChainAsync],
  );

  const value = useMemo<ChainState>(
    () => ({
      config: chainById(chainId),
      chainId,
      setChainId,
      wrongNetwork: isConnected && walletChainId !== undefined && walletChainId !== chainId,
      ensureChain,
    }),
    [chainId, setChainId, isConnected, walletChainId, ensureChain],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain() {
  const value = useContext(ChainContext);
  if (!value) throw new Error('useChain must be used inside <ChainProvider>');
  return value;
}
