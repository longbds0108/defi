import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleUniswapProxy } from './server/uniswapProxy.ts';

/// Dev-server twin of api/uniswap.ts: forwards /api/uniswap/* to the Uniswap
/// APIs with UNISWAP_API_KEY from .env.local. The key is read on the server
/// only (no VITE_ prefix), so it never ends up in the client bundle.
function uniswapProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'uniswap-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/uniswap', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const url = new URL(req.url ?? '/', 'http://localhost');
          const request = new Request(url, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
          });
          const response = await handleUniswapProxy(request, url.pathname, apiKey);
          res.statusCode = response.status;
          res.setHeader('content-type', response.headers.get('content-type') ?? 'application/json');
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ errorCode: 'PROXY_ERROR', detail: (error as Error).message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), uniswapProxy(env.UNISWAP_API_KEY || undefined)],
  };
});
