import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import { useAuth } from '../../auth/AuthProvider';
import { NATIVE } from '../../chains';
import { useChain } from '../../state/chain';
import { useBalances } from '../../hooks/useBalances';
import { useDebounced } from '../../hooks/useDebounced';
import { useFlow } from '../../hooks/useFlow';
import { FEE_TIERS, forProtocol, fullRangeTicks, priceFromSqrt, rawPriceString, sortTokens, sqrtFromPrice } from '../../lib/lpMath';
import { formatAmount, formatPct, formatUsd, sanitizeAmount } from '../../lib/format';
import { toSendParams, toTypedData } from '../../lib/tx';
import { lpApi, useUniswapStatus, type LpProtocol } from '../../uniswap/api';
import { Segmented, seededBars, useDemoSubmit, useToast } from '../../components/ui';
import { ChainTokenButton, ChainTokenPicker, FlowSteps, SourceBadge } from '../../components/chainUi';
import { safeParse } from '../trade/Swap';

const RANGE_PRESETS = [
  { label: '±2%', width: 0.02 },
  { label: '±10%', width: 0.1 },
  { label: '±25%', width: 0.25 },
  { label: 'Full range', width: Infinity },
];

function LiquidityChart({ price, min, max }: { price: number; min: number; max: number }) {
  const bars = useMemo(() => seededBars(Math.round(price * 1000) || 7), [price]);
  const lo = price * 0.5;
  const hi = price * 1.5;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const minPos = Number.isFinite(min) && min > 0 ? pos(min) : 0;
  const maxPos = Number.isFinite(max) ? pos(max) : 100;
  return (
    <div className="liq-chart" aria-hidden="true">
      <div className="liq-chart__bars">
        {bars.map((h, i) => {
          const center = ((i + 0.5) / bars.length) * 100;
          return <span key={i} style={{ height: `${h * 100}%` }} className={center >= minPos && center <= maxPos ? 'is-in' : undefined} />;
        })}
      </div>
      <div className="liq-chart__range" style={{ left: `${minPos}%`, width: `${Math.max(0.5, maxPos - minPos)}%` }} />
      <div className="liq-chart__price" style={{ left: `${pos(price)}%` }}>
        <span>Current</span>
      </div>
    </div>
  );
}

export function CreatePosition() {
  const { config, chainId, ensureChain } = useChain();
  const { address, connected } = useAuth();
  const status = useUniswapStatus();
  const live = config.uniswapApi && Boolean(status.data?.enabled);
  const toast = useToast();
  const demo = useDemoSubmit();
  const flow = useFlow();

  const tokens = config.tokens;
  const [protocol, setProtocol] = useState<LpProtocol>('V4');
  const [aAddr, setA] = useState(tokens[0].address);
  const [bAddr, setB] = useState((tokens.find((t) => t.symbol === 'USDC') ?? tokens[1]).address);
  useEffect(() => {
    setA(tokens[0].address);
    setB((tokens.find((t) => t.symbol === 'USDC') ?? tokens[1]).address);
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = forProtocol(tokens.find((t) => t.address === aAddr) ?? tokens[0], protocol, tokens);
  const b = forProtocol(tokens.find((t) => t.address === bAddr) ?? tokens[1], protocol, tokens);
  const [token0, token1] = sortTokens(a, b);
  const aIs0 = token0.address === a.address;

  const [tier, setTier] = useState<(typeof FEE_TIERS)[number]>(FEE_TIERS[2]);
  const [width, setWidth] = useState(0.1);
  const [amountA, setAmountA] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [picker, setPicker] = useState<'a' | 'b' | null>(null);
  const balances = useBalances(chainId, tokens);

  // Look up the pool for this pair + fee tier.
  const pool = useQuery({
    queryKey: ['pool-info', chainId, protocol, token0.address, token1.address, tier.fee],
    enabled: live,
    queryFn: () =>
      lpApi.poolInfo({
        protocol,
        chainId,
        poolParameters: { tokenAddressA: token0.address, tokenAddressB: token1.address, fee: tier.fee, tickSpacing: tier.tickSpacing, ...(protocol === 'V4' ? { hookAddress: NATIVE } : {}) },
      }),
    retry: false,
    staleTime: 30_000,
  });
  const existing = pool.data?.pools?.find((p) => Number(p.fee) === tier.fee) ?? pool.data?.pools?.[0];

  // Price shown as "b per a".
  const livePrice0in1 = existing ? priceFromSqrt(existing.sqrtRatioX96, token0.decimals, token1.decimals) : undefined;
  const manualPrice = Number(initialPrice) || 0;
  const estimate = a.usdHint / b.usdHint;
  const priceBA = livePrice0in1 !== undefined ? (aIs0 ? livePrice0in1 : 1 / livePrice0in1) : live && manualPrice ? manualPrice : estimate;
  const minBA = Number.isFinite(width) ? priceBA * (1 - width) : 0;
  const maxBA = Number.isFinite(width) ? priceBA * (1 + width) : Infinity;

  // API wants token1-per-token0 raw bounds.
  const bounds = useMemo(() => {
    if (!Number.isFinite(width)) return { tickBounds: fullRangeTicks(tier.tickSpacing) };
    const [lo0, hi0] = aIs0 ? [minBA, maxBA] : [1 / maxBA, 1 / minBA];
    return { priceBounds: { minPrice: rawPriceString(lo0, token0.decimals, token1.decimals), maxPrice: rawPriceString(hi0, token0.decimals, token1.decimals) } };
  }, [width, tier.tickSpacing, aIs0, minBA, maxBA, token0.decimals, token1.decimals]);

  const debouncedA = useDebounced(amountA);
  const rawA = safeParse(debouncedA, a.decimals);
  const poolSpec = existing
    ? { existingPool: { token0Address: token0.address, token1Address: token1.address, poolReference: existing.poolReferenceIdentifier } }
    : {
        newPool: {
          token0Address: token0.address,
          token1Address: token1.address,
          fee: tier.fee,
          tickSpacing: tier.tickSpacing,
          initialPrice: sqrtFromPrice(aIs0 ? priceBA : 1 / priceBA, token0.decimals, token1.decimals),
        },
      };
  const canPreview = live && connected && rawA > 0n && (existing || manualPrice > 0) && !pool.isLoading;

  // /lp/create computes the dependent amount from pool state; used as preview.
  const preview = useQuery({
    queryKey: ['lp-preview', chainId, protocol, token0.address, token1.address, tier.fee, rawA.toString(), JSON.stringify(bounds), existing?.poolReferenceIdentifier, manualPrice, address],
    enabled: Boolean(canPreview),
    queryFn: () =>
      lpApi.create({
        walletAddress: address,
        chainId,
        protocol,
        ...poolSpec,
        independentToken: { tokenAddress: a.address, amount: rawA.toString() },
        ...bounds,
        slippageTolerance: 0.5,
        simulateTransaction: false,
      }),
    retry: false,
    staleTime: 20_000,
  });

  const valueA = Number(amountA) || 0;
  const dependentRaw = preview.data ? (aIs0 ? preview.data.token1.amount : preview.data.token0.amount) : undefined;
  const amountB = dependentRaw ? Number(formatUnits(BigInt(dependentRaw), b.decimals)) : valueA * priceBA;
  const adjusted = preview.data
    ? (() => {
        const lo = Number(preview.data.adjustedMinPrice) * 10 ** (token0.decimals - token1.decimals);
        const hi = Number(preview.data.adjustedMaxPrice) * 10 ** (token0.decimals - token1.decimals);
        return aIs0 ? [lo, hi] : [1 / hi, 1 / lo];
      })()
    : undefined;

  const balA = balances.get(a);
  const balB = balances.get(b);
  const insufficient = connected && ((balA !== undefined && valueA > balA) || (balB !== undefined && preview.data && amountB > balB));

  async function executeLive() {
    if (!address || !preview.data) return;
    const rawB = BigInt(dependentRaw ?? '0');
    const summary = `${formatAmount(valueA)} ${a.symbol} + ${formatAmount(amountB)} ${b.symbol}`;
    const ok = await flow.run(
      [
        { id: 'network', label: `Use ${config.chain.name}` },
        { id: 'approve', label: 'Check token approvals' },
        { id: 'permit', label: 'Sign Permit2 batch (v4)' },
        { id: 'create', label: `Create ${protocol} position` },
      ],
      async () => {
        flow.update('network', { status: 'active' });
        await ensureChain();
        flow.update('network', { status: 'done' });

        flow.update('approve', { status: 'active' });
        const approvals = await lpApi.checkApproval({
          walletAddress: address,
          protocol,
          chainId,
          action: 'CREATE',
          lpTokens: [
            { tokenAddress: a.address, amount: parseUnits(amountA, a.decimals).toString() },
            { tokenAddress: b.address, amount: rawB.toString() },
          ],
        });
        if (approvals.transactions.length === 0) flow.update('approve', { status: 'skipped', note: 'Already approved' });
        for (const [i, item] of approvals.transactions.entries()) {
          flow.update('approve', { note: `${i + 1} of ${approvals.transactions.length}` });
          await flow.tx('approve', toSendParams(item.transaction), { kind: 'Approve', summary: 'LP token approval' });
        }

        let permitFields = {};
        if (approvals.v4BatchPermitData) {
          const signature = await flow.sign('permit', toTypedData(approvals.v4BatchPermitData));
          permitFields = { batchPermitData: approvals.v4BatchPermitData, signature };
        } else flow.update('permit', { status: 'skipped', note: 'Not required' });

        const built = await lpApi.create({
          walletAddress: address,
          chainId,
          protocol,
          ...poolSpec,
          independentToken: { tokenAddress: a.address, amount: parseUnits(amountA, a.decimals).toString() },
          ...bounds,
          slippageTolerance: 0.5,
          simulateTransaction: false,
          ...permitFields,
        });
        await flow.tx('create', toSendParams(built.create), { kind: 'Add liquidity', summary: `${summary} (${a.symbol}/${b.symbol})` });
      },
    );
    if (ok) {
      toast({ title: 'Position created', body: summary, tone: 'success' });
      setAmountA('');
      void balances.refetch();
    }
  }

  const baseApr = 8;
  const concentration = Number.isFinite(width) ? Math.min(12, 0.25 / width) : 1;

  return (
    <div className="split">
      <section className="panel panel--pad" aria-label="Create position">
        <div className="panel__head">
          <h2 className="panel__title">1 · Select pair</h2>
          <SourceBadge live={live} reason={!config.uniswapApi ? `${config.chain.name} not on LP API` : 'API key not set'} />
        </div>
        <div className="pair-select">
          <ChainTokenButton token={a} onClick={() => setPicker('a')} />
          <span className="muted">/</span>
          <ChainTokenButton token={b} onClick={() => setPicker('b')} />
          <Segmented
            label="Protocol"
            options={[
              { value: 'V4' as LpProtocol, label: 'v4' },
              { value: 'V3' as LpProtocol, label: 'v3' },
            ]}
            value={protocol}
            onChange={setProtocol}
          />
        </div>
        {protocol === 'V3' && (aAddr === NATIVE || bAddr === NATIVE) && <p className="modal__hint">v3 pools use WETH instead of native ETH.</p>}

        <h2 className="panel__title">2 · Fee tier</h2>
        <div className="fee-tiers">
          {FEE_TIERS.map((t) => (
            <button key={t.fee} type="button" className={tier.fee === t.fee ? 'is-active' : undefined} onClick={() => setTier(t)}>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
        {live && (
          <p className={`pool-status${existing ? ' is-found' : ''}`}>
            {pool.isLoading
              ? 'Looking up pool…'
              : existing
                ? `Pool found · ${protocol} · current price ${formatAmount(priceBA)} ${b.symbol} per ${a.symbol}`
                : pool.error
                  ? (pool.error as Error).message
                  : `No ${protocol} pool at ${tier.label} yet — you will create it and set the starting price.`}
          </p>
        )}
        {live && !existing && !pool.isLoading && (
          <label className="form-grid__wide initial-price">
            <span>
              Starting price ({b.symbol} per {a.symbol})
            </span>
            <input inputMode="decimal" placeholder={formatAmount(estimate)} value={initialPrice} onChange={(e) => setInitialPrice(sanitizeAmount(e.target.value, 12))} />
          </label>
        )}

        <h2 className="panel__title">3 · Price range</h2>
        <div className="chips">
          {RANGE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className={width === preset.width ? 'is-active' : undefined} onClick={() => setWidth(preset.width)}>
              {preset.label}
            </button>
          ))}
        </div>
        <LiquidityChart price={priceBA} min={minBA} max={maxBA} />
        <div className="range-inputs">
          <div>
            <small>Min price</small>
            <strong>{adjusted ? formatAmount(adjusted[0]) : Number.isFinite(width) ? formatAmount(minBA) : '0'}</strong>
            <span>
              {b.symbol} per {a.symbol}
            </span>
          </div>
          <div>
            <small>Current</small>
            <strong>{formatAmount(priceBA)}</strong>
            <span>{existing ? 'from pool' : live ? 'starting price' : 'estimate'}</span>
          </div>
          <div>
            <small>Max price</small>
            <strong>{adjusted ? formatAmount(adjusted[1]) : Number.isFinite(maxBA) ? formatAmount(maxBA) : '∞'}</strong>
            <span>
              {b.symbol} per {a.symbol}
            </span>
          </div>
        </div>
        {adjusted && <p className="modal__hint">Range snapped to valid ticks by the API (ticks {preview.data?.tickLower} → {preview.data?.tickUpper}).</p>}

        <h2 className="panel__title">4 · Deposit</h2>
        <div className="field">
          <div className="field__top">
            <span>{a.symbol}</span>
            {balA !== undefined && (
              <button type="button" className="link" onClick={() => setAmountA(String(balA))}>
                Balance {formatAmount(balA)} · Max
              </button>
            )}
          </div>
          <div className="field__row">
            <input inputMode="decimal" placeholder="0" value={amountA} onChange={(e) => setAmountA(sanitizeAmount(e.target.value, a.decimals))} aria-label={`${a.symbol} to deposit`} />
            <span className="token-static">{a.symbol}</span>
          </div>
        </div>
        <div className="field">
          <div className="field__top">
            <span>{b.symbol} (computed)</span>
            {balB !== undefined && <span>Balance {formatAmount(balB)}</span>}
          </div>
          <div className="field__row">
            <input readOnly placeholder="0" value={preview.isFetching ? '…' : valueA ? formatAmount(amountB) : ''} aria-label={`${b.symbol} to deposit`} />
            <span className="token-static">{b.symbol}</span>
          </div>
        </div>
        {preview.error && <p className="inline-error">{(preview.error as Error).message}</p>}
      </section>

      <aside className="panel panel--pad summary" aria-label="Position summary">
        <h2 className="panel__title">Summary</h2>
        <dl className="quote quote--flat">
          <div>
            <dt>Pool</dt>
            <dd>
              {a.symbol}/{b.symbol} · {tier.label} · {protocol}
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{config.chain.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{live ? (existing ? 'Existing pool' : 'New pool') : 'Demo'}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>{Number.isFinite(width) ? `${formatPct(-width * 100)} … ${formatPct(width * 100)}` : 'Full range'}</dd>
          </div>
          <div>
            <dt>Deposit</dt>
            <dd>
              {formatAmount(valueA)} {a.symbol} + {formatAmount(amountB)} {b.symbol}
            </dd>
          </div>
          {!live && (
            <div>
              <dt>Est. fee APR</dt>
              <dd className="up">{(baseApr * Math.max(1, concentration * 0.6)).toFixed(1)}% (demo)</dd>
            </div>
          )}
          {preview.data?.gasFee && (
            <div>
              <dt>Gas (est.)</dt>
              <dd>{formatUsd(Number(preview.data.gasFee))}</dd>
            </div>
          )}
        </dl>
        <p className="modal__hint">Narrow ranges earn more fees while the price stays inside, and earn nothing once it leaves.</p>
        <FlowSteps steps={flow.steps} error={flow.error} />
        {live ? (
          <button type="button" className="cta" disabled={!preview.data || Boolean(insufficient) || flow.running} onClick={() => void executeLive()}>
            {flow.running
              ? 'Working…'
              : !connected
                ? 'Connect wallet to add liquidity'
                : !valueA
                  ? 'Enter an amount'
                  : !existing && !manualPrice
                    ? 'Set a starting price'
                    : insufficient
                      ? 'Insufficient balance'
                      : preview.isFetching
                        ? 'Computing amounts…'
                        : 'Create position'}
          </button>
        ) : (
          <button type="button" className="cta" disabled={!valueA || demo.pending} onClick={() => demo.submit('Position created', `${formatAmount(valueA)} ${a.symbol} + ${formatAmount(amountB)} ${b.symbol}.`, () => setAmountA(''))}>
            {demo.pending ? 'Confirm in wallet…' : valueA ? 'Create position (demo)' : 'Enter an amount'}
          </button>
        )}
      </aside>

      <ChainTokenPicker open={picker === 'a'} onClose={() => setPicker(null)} tokens={tokens} exclude={bAddr} balances={balances.get} onSelect={(t) => setA(t.address)} />
      <ChainTokenPicker open={picker === 'b'} onClose={() => setPicker(null)} tokens={tokens} exclude={aAddr} balances={balances.get} onSelect={(t) => setB(t.address)} />
    </div>
  );
}

