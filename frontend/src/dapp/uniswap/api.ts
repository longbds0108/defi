import { useQuery } from '@tanstack/react-query';

// Client for the Uniswap Trading API and LP API, always through our own
// proxy (/api/uniswap) so the API key stays on the server.
// Schemas follow https://trade-api.gateway.uniswap.org/v1/api.json.

export class UniswapApiError extends Error {
  status: number;
  errorCode?: string;
  constructor(status: number, errorCode: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function call<T>(path: string, init?: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; headers?: Record<string, string> }): Promise<T> {
  const response = await fetch(`/api/uniswap/${path}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', accept: 'application/json', ...init?.headers },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    const code = (data.errorCode ?? data.error) as string | undefined;
    const detail = (data.detail ?? data.message ?? text) as string | undefined;
    throw new UniswapApiError(response.status, code, friendlyError(response.status, code, detail));
  }
  return data as T;
}

/** Map API failures to sentences users can act on (see Troubleshooting docs). */
function friendlyError(status: number, code?: string, detail?: string) {
  if (code === 'API_KEY_MISSING') return 'Live Uniswap data is off: UNISWAP_API_KEY is not configured.';
  if (status === 401) return 'The Uniswap API key was rejected.';
  if (status === 429) return 'Too many requests to Uniswap. Wait a moment and try again.';
  switch (code) {
    case 'NoRouteFoundError':
    case 'ResourceNotFound':
      return 'No route found for this pair on this network. Try another token or amount.';
    case 'QuoteAmountTooLowError':
      return 'Amount is too small to quote. Try a larger amount.';
    case 'UnsupportedTokenError':
      return 'One of these tokens is not supported by Uniswap.';
    case 'UpstreamTimeoutError':
      return 'Uniswap timed out while quoting. Try again.';
    default:
      return detail ? String(detail).slice(0, 200) : `Uniswap API error (${status}).`;
  }
}

/* ---------- Shared types ---------- */

export interface ApiTransaction {
  to: `0x${string}`;
  from: `0x${string}`;
  data: `0x${string}`;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface PermitData {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  values: Record<string, unknown>;
}

export type Routing = 'CLASSIC' | 'DUTCH_V2' | 'DUTCH_V3' | 'PRIORITY' | 'WRAP' | 'UNWRAP' | 'BRIDGE' | 'CHAINED' | 'DUTCH_LIMIT' | 'LIMIT_ORDER';

export interface QuoteResponse {
  requestId: string;
  routing: Routing;
  permitData: PermitData | null;
  quote: {
    input?: { amount: string; token: string };
    output?: { amount: string; token: string; minimumAmount?: string };
    priceImpact?: number;
    gasFeeUSD?: string;
    routeString?: string;
    slippage?: number;
    estimatedFillTimeMs?: number;
    timeEstimateMs?: number;
    orderId?: string;
    [key: string]: unknown;
  };
}

export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  amount: string;
  swapper: string;
  slippageTolerance?: number;
  routingPreference?: 'BEST_PRICE' | 'FASTEST';
}

/* ---------- Trading API ---------- */

export const tradeApi = {
  quote: (body: QuoteRequest) => call<QuoteResponse>('trade/quote', { body }),
  checkApproval: (body: { walletAddress: string; token: string; amount: string; chainId: number; tokenOut?: string; tokenOutChainId?: number }) =>
    call<{ approval: ApiTransaction | null; cancel: ApiTransaction | null }>('trade/check_approval', { body }),
  swap: (body: { quote: QuoteResponse['quote']; signature?: string; permitData?: PermitData }) =>
    call<{ swap: ApiTransaction }>('trade/swap', { body }),
  order: (body: { quote: QuoteResponse['quote']; signature: string; routing: Routing }) =>
    call<{ orderId: string; orderStatus: string }>('trade/order', { body }),
  orders: (orderId: string) => call<{ orders: Array<{ orderStatus: string; txHash?: string }> }>(`trade/orders?orderId=${orderId}`),
  swaps: (txHash: string, chainId: number) =>
    call<{ swaps: Array<{ status: 'PENDING' | 'SUCCESS' | 'NOT_FOUND' | 'FAILED' | 'EXPIRED'; txHash: string }> }>(
      `trade/swaps?txHashes=${txHash}&chainId=${chainId}`,
    ),
  createPlan: (quote: QuoteResponse['quote']) => call<PlanResponse>('trade/plan', { body: { routing: 'CHAINED', quote } }),
  getPlan: (planId: string, forceRefresh = false) => call<PlanResponse>(`trade/plan/${planId}${forceRefresh ? '?forceRefresh=true' : ''}`),
  patchPlan: (planId: string, stepIndex: number, proof: { txHash?: string; signature?: string }) =>
    call<PlanResponse>(`trade/plan/${planId}`, { method: 'PATCH', body: { steps: [{ stepIndex, proof }] } }),
};

export type PlanStepStatus = 'NOT_READY' | 'AWAITING_ACTION' | 'IN_PROGRESS' | 'COMPLETE' | 'STEP_ERROR';

export interface PlanStep {
  stepIndex: number;
  stepType: string;
  method: 'SEND_TX' | 'SIGN_MSG' | 'SEND_CALLS';
  payloadType: 'TX' | 'EIP_712' | 'EIP_5792';
  payload: Record<string, unknown>;
  status: PlanStepStatus;
  tokenInChainId?: number;
  tokenOutChainId?: number;
}

export interface PlanResponse {
  planId: string;
  status: 'ACTIVE' | 'AWAITING_ACTION' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  currentStepIndex: number;
  expectedOutput: string;
  steps: PlanStep[];
}

/* ---------- LP API ---------- */

export type LpProtocol = 'V3' | 'V4';

export interface PoolInfo {
  poolReferenceIdentifier: string;
  poolProtocol: LpProtocol | 'V2';
  tokenAddressA: string;
  tokenAddressB: string;
  tickSpacing: number;
  fee: number;
  hookAddress?: string;
  tokenDecimalsA: number;
  tokenDecimalsB: number;
  poolLiquidity: string;
  sqrtRatioX96: string;
  currentTick: number;
}

export const lpApi = {
  poolInfo: (body: {
    protocol: LpProtocol;
    chainId: number;
    poolParameters: { tokenAddressA: string; tokenAddressB: string; fee?: number; tickSpacing?: number; hookAddress?: string };
  }) => call<{ pools: PoolInfo[] }>('lp/pool_info', { body }),
  checkApproval: (body: {
    walletAddress: string;
    protocol: LpProtocol;
    chainId: number;
    lpTokens: Array<{ tokenAddress: string; amount: string }>;
    action: 'CREATE' | 'INCREASE' | 'DECREASE';
  }) =>
    call<{
      transactions: Array<{ transaction: ApiTransaction; cancelApproval: boolean }>;
      v4BatchPermitData?: PermitData | null;
      v3NftPermitData?: PermitData | null;
    }>('lp/check_approval', { body }),
  create: (body: Record<string, unknown>) =>
    call<{
      token0: { tokenAddress: string; amount: string };
      token1: { tokenAddress: string; amount: string };
      adjustedMinPrice: string;
      adjustedMaxPrice: string;
      tickLower: number;
      tickUpper: number;
      create: ApiTransaction;
      gasFee?: string;
    }>('lp/create', { body }),
};

/* ---------- Availability ---------- */

/** Whether the server has an API key. Cached for the session. */
export function useUniswapStatus() {
  return useQuery({
    queryKey: ['uniswap-status'],
    queryFn: async () => {
      try {
        return await call<{ enabled: boolean }>('status');
      } catch {
        return { enabled: false };
      }
    },
    staleTime: Infinity,
  });
}
