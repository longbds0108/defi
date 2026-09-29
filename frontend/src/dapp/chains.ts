import { defineChain } from 'viem';

// Arc Testnet is not bundled with viem, so it is declared here with several
// public RPCs; the wagmi transport falls back between them.
export const ARC_RPCS = [
  'https://rpc.testnet.arc.network',
  'https://rpc.blockdaemon.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.network',
  'https://rpc.drpc.testnet.arc.network',
] as const;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [...ARC_RPCS] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11' } },
  testnet: true,
});
