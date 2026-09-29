import { erc20Abi, formatUnits } from 'viem';
import { useBalance, useReadContracts } from 'wagmi';
import { NATIVE, type TokenInfo } from '../chains';
import { useAuth } from '../auth/AuthProvider';

/// On-chain balances for a token list on one chain (native + ERC-20 via
/// multicall). Returns human amounts keyed by token address (lowercase).
export function useBalances(chainId: number, tokens: TokenInfo[]) {
  const { address } = useAuth();
  const erc20s = tokens.filter((t) => t.address !== NATIVE);

  const native = useBalance({ address, chainId, query: { enabled: Boolean(address), refetchInterval: 15_000 } });
  const reads = useReadContracts({
    contracts: erc20s.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address!], chainId })),
    query: { enabled: Boolean(address) && erc20s.length > 0, refetchInterval: 15_000 },
  });

  const balances: Record<string, number> = {};
  const raw: Record<string, bigint> = {};
  if (native.data) {
    raw[NATIVE] = native.data.value;
    balances[NATIVE] = Number(formatUnits(native.data.value, native.data.decimals));
  }
  erc20s.forEach((t, i) => {
    const value = reads.data?.[i]?.result as bigint | undefined;
    if (value !== undefined) {
      raw[t.address.toLowerCase()] = value;
      balances[t.address.toLowerCase()] = Number(formatUnits(value, t.decimals));
    }
  });

  return {
    connected: Boolean(address),
    balances,
    raw,
    get: (token: TokenInfo) => balances[token.address.toLowerCase()] ?? (token.address === NATIVE ? balances[NATIVE] : undefined),
    getRaw: (token: TokenInfo) => raw[token.address.toLowerCase()] ?? (token.address === NATIVE ? raw[NATIVE] : undefined),
    isLoading: native.isLoading || reads.isLoading,
    refetch: () => Promise.all([native.refetch(), reads.refetch()]),
  };
}
