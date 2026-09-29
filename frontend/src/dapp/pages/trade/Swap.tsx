import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { useAuth } from '../../auth/AuthProvider';
import { isNative, type TokenInfo } from '../../chains';
import { useChain } from '../../state/chain';
import { useBalances } from '../../hooks/useBalances';
import { useDebounced } from '../../hooks/useDebounced';
import { useFlow } from '../../hooks/useFlow';
import { formatAmount, formatPct, formatUsd, sanitizeAmount } from '../../lib/format';
import { toSendParams, toTypedData } from '../../lib/tx';
import { tradeApi, useUniswapStatus, type QuoteResponse } from '../../uniswap/api';
import { Modal, useDemoSubmit, useToast } from '../../components/ui';
import { ChainTokenButton, ChainTokenPicker, FlowSteps, SourceBadge } from '../../components/chainUi';

const SLIPPAGES = [0.1, 0.5, 1];
// Placeholder swapper so visitors get indicative quotes before connecting.
const PREVIEW_SWAPPER = '0x000000000000000000000000000000000000dEaD';
const UNISWAPX = ['DUTCH_V2', 'DUTCH_V3', 'PRIORITY'];

export function safeParse(value: string, decimals: number) {
  try {
    return value && Number(value) > 0 ? parseUnits(value, decimals) : 0n;
  } catch {
    return 0n;
  }
}

function defaultPair(tokens: TokenInfo[]) {
  const a = tokens[0];
  const b = tokens.find((t) => t.symbol === 'USDC' && t.address !== a.address) ?? tokens[1];
  return [a.address, b.address] as const;
}

export function Swap() {
  const { config, chainId, ensureChain, wrongNetwork } = useChain();
  const { address, connected } = useAuth();
  const status = useUniswapStatus();
  const live = config.uniswapApi && Boolean(status.data?.enabled);
  const demoReason = !config.uniswapApi ? `${config.chain.name} not on Uniswap API` : status.data && !status.data.enabled ? 'API key not set' : undefined;
  const toast = useToast();
  const demo = useDemoSubmit();
  const flow = useFlow();

  const tokens = config.tokens;
  const [pair, setPair] = useState(() => defaultPair(tokens));
  useEffect(() => setPair(defaultPair(tokens)), [chainId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tokenIn = tokens.find((t) => t.address === pair[0]) ?? tokens[0];
  const tokenOut = tokens.find((t) => t.address === pair[1]) ?? tokens[1];

  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'in' | 'out' | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [settings, setSettings] = useState(false);
  const [review, setReview] = useState(false);

  const balances = useBalances(chainId, tokens);
  const balanceIn = balances.get(tokenIn);
  const debounced = useDebounced(amount);
  const amountRaw = safeParse(debounced, tokenIn.decimals);
  const amountIn = Number(amount) || 0;

  const quote = useQuery({
    queryKey: ['quote', chainId, tokenIn.address, tokenOut.address, amountRaw.toString(), address, slippage],
    enabled: live && amountRaw > 0n,
    queryFn: () =>
      tradeApi.quote({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        type: 'EXACT_INPUT',
        amount: amountRaw.toString(),
        swapper: address ?? PREVIEW_SWAPPER,
        slippageTolerance: slippage,
      }),
    refetchInterval: 30_000, // quotes older than 30s should be refreshed
    staleTime: 25_000,
    retry: false,
  });

  // Normalised view of either the live quote or the demo estimate.
  const view = useMemo(() => {
    if (live && quote.data) {
      const q = quote.data.quote;
      const out = q.output ? Number(formatUnits(BigInt(q.output.amount), tokenOut.decimals)) : 0;
      const min = q.output?.minimumAmount ? Number(formatUnits(BigInt(q.output.minimumAmount), tokenOut.decimals)) : out * (1 - slippage / 100);
      return {
        out,
        min,
        impact: q.priceImpact !== undefined ? Number(q.priceImpact) : undefined,
        gasUsd: q.gasFeeUSD !== undefined ? Number(q.gasFeeUSD) : undefined,
        route: q.routeString ?? quote.data.routing,
        routing: quote.data.routing,
        rate: amountIn ? out / amountIn : 0,
      };
    }
    if (live) return null;
    const valueUsd = amountIn * tokenIn.usdHint;
    const out = (valueUsd * 0.997) / tokenOut.usdHint;
    return { out, min: out * (1 - slippage / 100), impact: undefined, gasUsd: undefined, route: `${tokenIn.symbol} → ${tokenOut.symbol}`, routing: 'DEMO', rate: amountIn ? out / amountIn : 0 };
  }, [live, quote.data, tokenIn, tokenOut, amountIn, slippage]);

  const insufficient = connected && balanceIn !== undefined && amountIn > balanceIn;
  const quoting = live && amountRaw > 0n && (quote.isFetching || debounced !== amount) && !quote.data;
  const cta = !amountIn
    ? 'Enter an amount'
    : insufficient
      ? `Insufficient ${tokenIn.symbol} balance`
      : quoting
        ? 'Fetching best price…'
        : live && quote.error
          ? 'No quote available'
          : live && !connected
            ? 'Connect wallet to swap'
            : 'Review swap';

  const flip = () => {
    setPair([pair[1], pair[0]]);
    setAmount(view?.out ? String(Number(view.out.toFixed(6))) : '');
  };

  async function executeLive() {
    if (!address) return;
    const summary = `${formatAmount(amountIn)} ${tokenIn.symbol} → ${tokenOut.symbol}`;
    const ok = await flow.run(
      [
        { id: 'network', label: `Use ${config.chain.name}` },
        ...(isNative(tokenIn.address) ? [] : [{ id: 'approve', label: `Approve ${tokenIn.symbol} for Permit2` }]),
        { id: 'quote', label: 'Refresh quote' },
        { id: 'permit', label: 'Sign Permit2 message' },
        { id: 'swap', label: 'Confirm swap in wallet' },
      ],
      async () => {
        flow.update('network', { status: 'active' });
        await ensureChain();
        flow.update('network', { status: 'done' });

        const raw = parseUnits(amount, tokenIn.decimals);
        if (!isNative(tokenIn.address)) {
          flow.update('approve', { status: 'active' });
          const { approval, cancel } = await tradeApi.checkApproval({
            walletAddress: address,
            token: tokenIn.address,
            amount: raw.toString(),
            chainId,
            tokenOut: tokenOut.address,
            tokenOutChainId: chainId,
          });
          if (cancel) await flow.tx('approve', toSendParams(cancel));
          if (approval) await flow.tx('approve', toSendParams(approval), { kind: 'Approve', summary: `Approve ${tokenIn.symbol}` });
          else flow.update('approve', { status: 'skipped', note: 'Already approved' });
        }

        flow.update('quote', { status: 'active' });
        const fresh: QuoteResponse = await tradeApi.quote({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          tokenInChainId: chainId,
          tokenOutChainId: chainId,
          type: 'EXACT_INPUT',
          amount: raw.toString(),
          swapper: address,
          slippageTolerance: slippage,
        });
        flow.update('quote', { status: 'done', note: fresh.routing });

        let signature: string | undefined;
        if (fresh.permitData) signature = await flow.sign('permit', toTypedData(fresh.permitData));
        else flow.update('permit', { status: 'skipped', note: 'Not required' });

        if (UNISWAPX.includes(fresh.routing)) {
          // Gasless UniswapX order: a filler executes it on-chain.
          flow.update('swap', { status: 'active', label: 'Submit UniswapX order' });
          const order = await tradeApi.order({ quote: fresh.quote, signature: signature!, routing: fresh.routing });
          for (let i = 0; i < 40; i += 1) {
            await new Promise((r) => setTimeout(r, 3_000));
            const { orders } = await tradeApi.orders(order.orderId);
            const s = orders[0]?.orderStatus;
            if (s === 'filled') {
              flow.update('swap', { status: 'done', hash: orders[0].txHash, chainId });
              return;
            }
            if (s && ['expired', 'error', 'cancelled', 'insufficient-funds'].includes(s)) throw new Error(`Order ${s}.`);
          }
          throw new Error('Order not filled yet. Check Portfolio → Activity later.');
        }

        const { swap } = await tradeApi.swap(fresh.permitData && signature ? { quote: fresh.quote, signature, permitData: fresh.permitData } : { quote: fresh.quote });
        await flow.tx('swap', toSendParams(swap), { kind: 'Swap', summary });
      },
    );
    if (ok) {
      toast({ title: 'Swap confirmed', body: summary, tone: 'success' });
      setAmount('');
      void balances.refetch();
    }
  }

  return (
    <section className="widget" aria-label="Swap">
      <div className="widget__head">
        <SourceBadge live={live} reason={demoReason} />
        <button type="button" className="icon-btn" aria-label="Swap settings" onClick={() => setSettings(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div className="field">
        <div className="field__top">
          <span>You pay</span>
          {balanceIn !== undefined ? (
            <button type="button" className="link" onClick={() => setAmount(String(isNative(tokenIn.address) ? Math.max(0, balanceIn - 0.002) : balanceIn))}>
              Balance {formatAmount(balanceIn)} · Max
            </button>
          ) : (
            <span>{connected ? '…' : 'Connect to see balance'}</span>
          )}
        </div>
        <div className="field__row">
          <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, tokenIn.decimals))} aria-label={`Amount of ${tokenIn.symbol} to pay`} />
          <ChainTokenButton token={tokenIn} onClick={() => setPicker('in')} />
        </div>
        <div className="field__foot">≈ {formatUsd(amountIn * tokenIn.usdHint)}</div>
      </div>

      <motion.button type="button" className="flip" aria-label="Switch tokens" onClick={flip} whileTap={{ rotate: 180 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </motion.button>

      <div className="field">
        <div className="field__top">
          <span>You receive</span>
          <span>{balances.get(tokenOut) !== undefined ? `Balance ${formatAmount(balances.get(tokenOut)!)}` : ''}</span>
        </div>
        <div className="field__row">
          <input readOnly placeholder="0" value={quoting ? '…' : view?.out ? formatAmount(view.out) : ''} aria-label={`Estimated ${tokenOut.symbol} received`} />
          <ChainTokenButton token={tokenOut} onClick={() => setPicker('out')} />
        </div>
        <div className="field__foot">
          ≈ {formatUsd((view?.out ?? 0) * tokenOut.usdHint)}
          {view?.impact !== undefined && <span className={view.impact > 3 ? 'down' : undefined}> · impact {formatPct(-Math.abs(view.impact))}</span>}
        </div>
      </div>

      {live && quote.error && amountRaw > 0n && <p className="inline-error">{(quote.error as Error).message}</p>}
      {wrongNetwork && <p className="inline-warn">Your wallet is on another network. You’ll be asked to switch to {config.chain.name}.</p>}

      {amountIn > 0 && view && (
        <dl className="quote">
          <div>
            <dt>Rate</dt>
            <dd>
              1 {tokenIn.symbol} = {formatAmount(view.rate)} {tokenOut.symbol}
            </dd>
          </div>
          <div>
            <dt>Minimum received</dt>
            <dd>
              {formatAmount(view.min)} {tokenOut.symbol}
            </dd>
          </div>
          <div>
            <dt>Max slippage</dt>
            <dd>{slippage}%</dd>
          </div>
          {view.gasUsd !== undefined && (
            <div>
              <dt>Network fee</dt>
              <dd>~{formatUsd(view.gasUsd)}</dd>
            </div>
          )}
          <div>
            <dt>{live ? `Route · ${view.routing}` : 'Route'}</dt>
            <dd className="route">{view.route}</dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        className="cta"
        disabled={!amountIn || insufficient || quoting || (live && (!quote.data || !connected))}
        onClick={() => {
          flow.reset();
          setReview(true);
        }}
      >
        {cta}
      </button>

      <ChainTokenPicker open={picker === 'in'} onClose={() => setPicker(null)} tokens={tokens} exclude={tokenOut.address} balances={balances.get} onSelect={(t) => setPair([t.address, pair[1]])} />
      <ChainTokenPicker open={picker === 'out'} onClose={() => setPicker(null)} tokens={tokens} exclude={tokenIn.address} balances={balances.get} onSelect={(t) => setPair([pair[0], t.address])} />

      <Modal open={settings} onClose={() => setSettings(false)} title="Settings">
        <p className="modal__label">Max slippage</p>
        <div className="chips">
          {SLIPPAGES.map((value) => (
            <button key={value} type="button" className={slippage === value ? 'is-active' : undefined} onClick={() => setSlippage(value)}>
              {value}%
            </button>
          ))}
        </div>
        <p className="modal__hint">Your transaction reverts if the price moves unfavourably by more than this.</p>
      </Modal>

      <Modal open={review} onClose={() => !flow.running && setReview(false)} title="Review swap">
        <div className="review">
          <div>
            <small>You pay</small>
            <strong>
              {formatAmount(amountIn)} {tokenIn.symbol}
            </strong>
            <span>on {config.chain.name}</span>
          </div>
          <div>
            <small>You receive (est.)</small>
            <strong>
              {formatAmount(view?.out ?? 0)} {tokenOut.symbol}
            </strong>
            <span>
              min {formatAmount(view?.min ?? 0)} {tokenOut.symbol}
            </span>
          </div>
        </div>
        <FlowSteps steps={flow.steps} error={flow.error} />
        {live ? (
          <button type="button" className="cta" disabled={flow.running} onClick={() => void executeLive()}>
            {flow.running ? 'Working…' : flow.error ? 'Try again' : 'Confirm swap'}
          </button>
        ) : (
          <button
            type="button"
            className="cta"
            disabled={demo.pending}
            onClick={() =>
              demo.submit('Swap submitted', `${formatAmount(amountIn)} ${tokenIn.symbol} → ${formatAmount(view?.out ?? 0)} ${tokenOut.symbol}.`, () => {
                setReview(false);
                setAmount('');
              })
            }
          >
            {demo.pending ? 'Confirm in wallet…' : 'Confirm swap (demo)'}
          </button>
        )}
      </Modal>
    </section>
  );
}
