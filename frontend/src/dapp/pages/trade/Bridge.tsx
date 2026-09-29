import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { useAuth } from '../../auth/AuthProvider';
import { CHAINS, chainById, type ChainConfig } from '../../chains';
import { useChain } from '../../state/chain';
import { useBalances } from '../../hooks/useBalances';
import { useDebounced } from '../../hooks/useDebounced';
import { useFlow } from '../../hooks/useFlow';
import { formatAmount, formatUsd, sanitizeAmount, shortAddress } from '../../lib/format';
import { toSendParams, toTypedData } from '../../lib/tx';
import { tradeApi, useUniswapStatus, type ApiTransaction, type PermitData, type PlanResponse, type PlanStep } from '../../uniswap/api';
import { Modal, useDemoSubmit, useToast } from '../../components/ui';
import { ChainDot, FlowSteps, SourceBadge } from '../../components/chainUi';
import { safeParse } from './Swap';

const PREVIEW_SWAPPER = '0x000000000000000000000000000000000000dEaD';
const BRIDGE_SYMBOLS = ['ETH', 'USDC', 'WETH', 'EURC'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function NetworkButton({ config, onClick, label }: { config: ChainConfig; onClick: () => void; label: string }) {
  return (
    <button type="button" className="network-button" onClick={onClick} aria-label={`${label}: ${config.chain.name}`}>
      <ChainDot config={config} size={28} />
      <span>
        <small>{label}</small>
        <strong>{config.chain.name}</strong>
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function stepLabel(step: PlanStep) {
  const chain = step.tokenInChainId ? ` on ${chainById(step.tokenInChainId).chain.name}` : '';
  switch (step.stepType) {
    case 'APPROVAL_TXN':
    case 'RESET_APPROVAL_TXN':
      return `Approve token${chain}`;
    case 'APPROVAL_PERMIT':
      return 'Sign Permit2 message';
    case 'BRIDGE':
      return `Bridge${chain}`;
    case 'SWAP_BRIDGE':
      return `Swap and bridge${chain}`;
    default:
      return `${step.stepType.replace(/_/g, ' ').toLowerCase()}${chain}`;
  }
}

export function Bridge() {
  const { chainId, ensureChain } = useChain();
  const { address, connected } = useAuth();
  const status = useUniswapStatus();
  const apiChains = CHAINS.filter((c) => c.uniswapApi);
  const toast = useToast();
  const demo = useDemoSubmit();
  const flow = useFlow();

  const [fromId, setFromId] = useState(() => (apiChains.some((c) => c.chain.id === chainId) ? chainId : apiChains[0].chain.id));
  const [toId, setToId] = useState(() => apiChains.find((c) => c.chain.id !== fromId)!.chain.id);
  const from = chainById(fromId);
  const to = chainById(toId);
  const live = Boolean(status.data?.enabled) && from.uniswapApi && to.uniswapApi;

  const symbols = BRIDGE_SYMBOLS.filter((s) => from.tokens.some((t) => t.symbol === s) && to.tokens.some((t) => t.symbol === s));
  const [symbol, setSymbol] = useState('ETH');
  const activeSymbol = symbols.includes(symbol) ? symbol : symbols[0];
  const tokenIn = from.tokens.find((t) => t.symbol === activeSymbol)!;
  const tokenOut = to.tokens.find((t) => t.symbol === activeSymbol)!;

  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [review, setReview] = useState(false);
  const balances = useBalances(fromId, from.tokens);
  const balance = balances.get(tokenIn);
  const debounced = useDebounced(amount);
  const amountRaw = safeParse(debounced, tokenIn.decimals);
  const value = Number(amount) || 0;

  const quote = useQuery({
    queryKey: ['bridge-quote', fromId, toId, tokenIn.address, tokenOut.address, amountRaw.toString(), address],
    enabled: live && amountRaw > 0n,
    queryFn: () =>
      tradeApi.quote({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        tokenInChainId: fromId,
        tokenOutChainId: toId,
        type: 'EXACT_INPUT',
        amount: amountRaw.toString(),
        swapper: address ?? PREVIEW_SWAPPER,
        slippageTolerance: 0.5,
      }),
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: false,
  });

  const view = useMemo(() => {
    if (live && quote.data) {
      const q = quote.data.quote;
      const out = q.output ? Number(formatUnits(BigInt(q.output.amount), tokenOut.decimals)) : 0;
      const ms = q.estimatedFillTimeMs ?? q.timeEstimateMs;
      return { out, gasUsd: q.gasFeeUSD ? Number(q.gasFeeUSD) : undefined, eta: ms ? Math.max(1, Math.round(Number(ms) / 60_000)) : undefined, routing: quote.data.routing };
    }
    if (live) return null;
    return { out: value * 0.9995, gasUsd: undefined, eta: undefined, routing: 'DEMO' };
  }, [live, quote.data, tokenOut.decimals, value]);

  const insufficient = connected && balance !== undefined && value > balance;
  const quoting = live && amountRaw > 0n && !quote.data && (quote.isFetching || debounced !== amount);

  async function runPlan(initial: PlanResponse) {
    let plan = initial;
    for (let guard = 0; guard < 200; guard += 1) {
      if (plan.status === 'COMPLETED') return;
      const failed = plan.steps.find((s) => s.status === 'STEP_ERROR');
      if (failed || plan.status === 'FAILED') throw new Error('A bridge step failed. Retry to re-plan from the last completed step.');
      const step = plan.steps[plan.currentStepIndex];
      const id = `plan-${step.stepIndex}`;
      flow.addStep({ id, label: stepLabel(step) });

      if (step.status === 'AWAITING_ACTION') {
        if (step.method === 'SEND_TX') {
          const tx = step.payload as unknown as ApiTransaction;
          await ensureChain(tx.chainId ?? step.tokenInChainId);
          const { hash } = await flow.tx(id, toSendParams(tx), { kind: 'Bridge', summary: stepLabel(step) });
          plan = await tradeApi.patchPlan(plan.planId, step.stepIndex, { txHash: hash });
        } else if (step.method === 'SIGN_MSG') {
          const payload = step.payload as Record<string, unknown>;
          const permit = { domain: payload.domain, types: payload.types, values: payload.values ?? payload.message } as PermitData;
          const signature = await flow.sign(id, toTypedData(permit));
          plan = await tradeApi.patchPlan(plan.planId, step.stepIndex, { signature });
        } else {
          throw new Error('This route needs batched calls (EIP-5792), which this wallet flow does not support yet.');
        }
      } else {
        flow.update(id, { status: 'active', note: step.status === 'IN_PROGRESS' ? 'Waiting for confirmation…' : undefined });
        await sleep(5_000);
        plan = await tradeApi.getPlan(plan.planId);
        if (plan.steps[step.stepIndex]?.status === 'COMPLETE') flow.update(id, { status: 'done', note: undefined });
      }
    }
    throw new Error('Bridge is still in progress. Check Portfolio → Activity later.');
  }

  async function executeLive() {
    if (!address) return;
    const summary = `${formatAmount(value)} ${activeSymbol} ${from.short} → ${to.short}`;
    const ok = await flow.run([{ id: 'quote', label: 'Refresh route' }], async () => {
      flow.update('quote', { status: 'active' });
      const fresh = await tradeApi.quote({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        tokenInChainId: fromId,
        tokenOutChainId: toId,
        type: 'EXACT_INPUT',
        amount: parseUnits(amount, tokenIn.decimals).toString(),
        swapper: address,
        slippageTolerance: 0.5,
      });
      flow.update('quote', { status: 'done', note: fresh.routing });

      if (fresh.routing === 'CHAINED') {
        flow.addStep({ id: 'plan', label: 'Create execution plan' }, 'active');
        const plan = await tradeApi.createPlan(fresh.quote);
        flow.update('plan', { status: 'done', note: `${plan.steps.length} steps` });
        await runPlan(plan);
        return;
      }

      // Single-transaction bridge (routing BRIDGE): same /swap flow as a swap.
      await ensureChain(fromId);
      flow.addStep({ id: 'bridge', label: `Bridge on ${from.chain.name}` });
      const { swap } = await tradeApi.swap({ quote: fresh.quote });
      await flow.tx('bridge', toSendParams(swap), { kind: 'Bridge', summary });
    });
    if (ok) {
      toast({ title: 'Bridge submitted', body: `${summary}. Funds arrive after the relayer fills.`, tone: 'success' });
      setAmount('');
    }
  }

  const pick = (id: number) => {
    if (picker === 'from') {
      if (id === toId) setToId(fromId);
      setFromId(id);
    } else {
      if (id === fromId) setFromId(toId);
      setToId(id);
    }
    setPicker(null);
  };

  return (
    <section className="widget" aria-label="Bridge">
      <div className="widget__head">
        <SourceBadge live={live} reason={status.data && !status.data.enabled ? 'API key not set' : undefined} />
      </div>

      <div className="bridge-nets">
        <NetworkButton label="From" config={from} onClick={() => setPicker('from')} />
        <button type="button" className="flip flip--inline" aria-label="Switch networks" onClick={() => { setFromId(toId); setToId(fromId); }}>
          ⇄
        </button>
        <NetworkButton label="To" config={to} onClick={() => setPicker('to')} />
      </div>

      <div className="field">
        <div className="field__top">
          <span>Amount</span>
          {balance !== undefined ? (
            <button type="button" className="link" onClick={() => setAmount(String(balance))}>
              Balance {formatAmount(balance)} · Max
            </button>
          ) : (
            <span>{connected ? '…' : 'Connect to see balance'}</span>
          )}
        </div>
        <div className="field__row">
          <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, tokenIn.decimals))} aria-label="Amount to bridge" />
          <div className="segmented" role="tablist" aria-label="Token">
            {symbols.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={s === activeSymbol} className={s === activeSymbol ? 'is-active' : undefined} onClick={() => setSymbol(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="field__foot">≈ {formatUsd(value * tokenIn.usdHint)}</div>
      </div>

      {live && quote.error && amountRaw > 0n && <p className="inline-error">{(quote.error as Error).message} Testnet bridge routes (Across) are limited.</p>}

      <dl className="quote">
        <div>
          <dt>You receive on {to.short}</dt>
          <dd>{quoting ? '…' : `${formatAmount(view?.out ?? 0)} ${activeSymbol}`}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{address ? `${shortAddress(address)} (you)` : 'Your connected wallet'}</dd>
        </div>
        {view?.gasUsd !== undefined && (
          <div>
            <dt>Network fees</dt>
            <dd>~{formatUsd(view.gasUsd)}</dd>
          </div>
        )}
        <div>
          <dt>Estimated time</dt>
          <dd>{view?.eta ? `~${view.eta} min` : live ? '—' : '~2 min'}</dd>
        </div>
        {view && live && (
          <div>
            <dt>Route</dt>
            <dd>{view.routing}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        className="cta"
        disabled={!value || insufficient || quoting || (live && (!quote.data || !connected))}
        onClick={() => {
          flow.reset();
          setReview(true);
        }}
      >
        {!value ? 'Enter an amount' : insufficient ? `Insufficient ${activeSymbol} balance` : quoting ? 'Finding route…' : live && !connected ? 'Connect wallet to bridge' : `Review bridge to ${to.chain.name}`}
      </button>

      <Modal open={picker !== null} onClose={() => setPicker(null)} title={picker === 'from' ? 'Bridge from' : 'Bridge to'}>
        <ul className="token-list">
          {apiChains.map((c) => (
            <li key={c.chain.id}>
              <button type="button" onClick={() => pick(c.chain.id)}>
                <ChainDot config={c} size={34} />
                <span>
                  <strong>{c.chain.name}</strong>
                  <small>Chain ID {c.chain.id}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="modal__hint">Arc Testnet is not served by the Uniswap API, so it is not available as a bridge route.</p>
      </Modal>

      <Modal open={review} onClose={() => !flow.running && setReview(false)} title="Review bridge">
        <div className="review">
          <div>
            <small>From {from.chain.name}</small>
            <strong>
              {formatAmount(value)} {activeSymbol}
            </strong>
          </div>
          <div>
            <small>To {to.chain.name} (est.)</small>
            <strong>
              {formatAmount(view?.out ?? 0)} {activeSymbol}
            </strong>
          </div>
        </div>
        <FlowSteps steps={flow.steps} error={flow.error} />
        {live ? (
          <button type="button" className="cta" disabled={flow.running} onClick={() => void executeLive()}>
            {flow.running ? 'Working…' : flow.error ? 'Try again' : 'Confirm bridge'}
          </button>
        ) : (
          <button type="button" className="cta" disabled={demo.pending} onClick={() => demo.submit('Bridge started', `${formatAmount(value)} ${activeSymbol} ${from.short} → ${to.short}.`, () => { setReview(false); setAmount(''); })}>
            {demo.pending ? 'Confirm in wallet…' : 'Confirm bridge (demo)'}
          </button>
        )}
      </Modal>
    </section>
  );
}
