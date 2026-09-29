// Server-side proxy for the Uniswap APIs. The API key must never reach the
// browser (per Uniswap's integration guide), so the app calls
// /api/uniswap/<service>/<path> and this handler forwards the request with
// the key attached. Used by the Vite dev server and the Vercel function.

const UPSTREAMS = {
  trade: 'https://trade-api.gateway.uniswap.org/v1',
  lp: 'https://liquidity.api.uniswap.org/lp',
} as const;

// Only the endpoints the app uses are forwarded.
const ALLOWED: Record<keyof typeof UPSTREAMS, RegExp> = {
  trade: /^(quote|check_approval|swap|order|orders|swaps|swappable_tokens|plan|plan\/[\w-]+)$/,
  lp: /^(check_approval|create|increase|decrease|claim_fees|pool_info)$/,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * @param request incoming request
 * @param path    everything after /api/uniswap/, e.g. "trade/quote"
 * @param apiKey  UNISWAP_API_KEY from the server environment
 */
export async function handleUniswapProxy(request: Request, path: string, apiKey: string | undefined): Promise<Response> {
  const clean = path.replace(/^\/+|\/+$/g, '');

  if (clean === 'status') return json(200, { enabled: Boolean(apiKey) });

  const [service, ...rest] = clean.split('/');
  const endpoint = rest.join('/');
  if (!(service in UPSTREAMS) || !ALLOWED[service as keyof typeof UPSTREAMS].test(endpoint)) {
    return json(404, { errorCode: 'UNKNOWN_ENDPOINT', detail: `Unsupported endpoint: ${clean}` });
  }
  if (!apiKey) {
    return json(503, { errorCode: 'API_KEY_MISSING', detail: 'Set UNISWAP_API_KEY on the server to enable live Uniswap data.' });
  }
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
    return json(405, { errorCode: 'METHOD_NOT_ALLOWED', detail: request.method });
  }

  const url = new URL(request.url);
  const upstream = `${UPSTREAMS[service as keyof typeof UPSTREAMS]}/${endpoint}${url.search}`;
  const body = request.method === 'GET' ? undefined : await request.text();

  const response = await fetch(upstream, {
    method: request.method,
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
      // Pass through optional Uniswap headers the client may set.
      ...pick(request.headers, ['x-universal-router-version', 'x-erc20eth-enabled']),
    },
    body,
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}

function pick(headers: Headers, names: string[]) {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}
