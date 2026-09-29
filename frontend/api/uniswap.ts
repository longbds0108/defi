// Vercel Edge Function. vercel.json rewrites /api/uniswap/<path> to
// /api/uniswap?path=<path>; UNISWAP_API_KEY is set in the Vercel project env.
import { handleUniswapProxy } from '../server/uniswapProxy';

export const config = { runtime: 'edge' };

export default function handler(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '';
  return handleUniswapProxy(request, path, process.env.UNISWAP_API_KEY);
}
