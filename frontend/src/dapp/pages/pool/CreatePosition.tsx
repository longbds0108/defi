import { useMemo, useState } from 'react';
import { FEE_TIERS, POOLS, seeded, tokenBySymbol } from '../../data/demo';
import { formatAmount, formatPct, formatUsd, sanitizeAmount } from '../../lib/format';
import { TokenButton, TokenPicker, useDemoSubmit } from '../../components/ui';

const RANGE_PRESETS = [
  { label: '±2%', width: 0.02 },
  { label: '±10%', width: 0.1 },
  { label: '±25%', width: 0.25 },
  { label: 'Full range', width: Infinity },
];

/// Demo liquidity histogram around the current price.
function LiquidityChart({ price, min, max }: { price: number; min: number; max: number }) {
  const bars = useMemo(() => {
    const rand = seeded(Math.round(price * 1000));
    return Array.from({ length: 48 }, (_, i) => {
      const x = (i - 24) / 24; // -1..1 around price
      return 0.25 + Math.exp(-x * x * 5) * 0.75 * (0.7 + rand() * 0.3);
    });
  }, [price]);
  const lo = price * 0.5;
  const hi = price * 1.5;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const minPos = Number.isFinite(min) ? pos(min) : 0;
  const maxPos = Number.isFinite(max) ? pos(max) : 100;

  return (
    <div className="liq-chart" aria-hidden="true">
      <div className="liq-chart__bars">
        {bars.map((h, i) => {
          const center = ((i + 0.5) / bars.length) * 100;
          const inside = center >= minPos && center <= maxPos;
          return <span key={i} style={{ height: `${h * 100}%` }} className={inside ? 'is-in' : undefined} />;
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
  const [a, setA] = useState('ETH');
  const [b, setB] = useState('USDC');
  const [fee, setFee] = useState(30);
  const [width, setWidth] = useState(0.1);
  const [amountA, setAmountA] = useState('');
  const [picker, setPicker] = useState<'a' | 'b' | null>(null);
  const { pending, submit } = useDemoSubmit();

  const tokenA = tokenBySymbol(a);
  const tokenB = tokenBySymbol(b);
  const price = tokenA.price / tokenB.price; // B per A
  const min = Number.isFinite(width) ? price * (1 - width) : 0;
  const max = Number.isFinite(width) ? price * (1 + width) : Infinity;
  const existing = POOLS.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));

  const valueA = Number(amountA) || 0;
  const amountB = valueA * price; // symmetric range ⇒ ~equal value on each side (demo)
  const depositUsd = valueA * tokenA.price * 2;
  // Narrower ranges concentrate liquidity and earn a larger fee share (demo estimate).
  const baseApr = existing?.apr ?? 8;
  const concentration = Number.isFinite(width) ? Math.min(12, 0.25 / width) : 1;
  const estApr = baseApr * Math.max(1, concentration * 0.6);

  return (
    <div className="split">
      <section className="panel panel--pad" aria-label="Create position">
        <h2 className="panel__title">1 · Select pair</h2>
        <div className="pair-select">
          <TokenButton symbol={a} onClick={() => setPicker('a')} />
          <span className="muted">/</span>
          <TokenButton symbol={b} onClick={() => setPicker('b')} />
        </div>

        <h2 className="panel__title">2 · Fee tier</h2>
        <div className="fee-tiers">
          {FEE_TIERS.map((tier) => (
            <button key={tier.bps} type="button" className={fee === tier.bps ? 'is-active' : undefined} onClick={() => setFee(tier.bps)}>
              <strong>{tier.label}</strong>
              <small>{tier.hint}</small>
              {existing?.feeBps === tier.bps && <em>Most liquidity</em>}
            </button>
          ))}
        </div>

        <h2 className="panel__title">3 · Price range</h2>
        <div className="chips">
          {RANGE_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className={width === preset.width ? 'is-active' : undefined} onClick={() => setWidth(preset.width)}>
              {preset.label}
            </button>
          ))}
        </div>
        <LiquidityChart price={price} min={min} max={max} />
        <div className="range-inputs">
          <div>
            <small>Min price</small>
            <strong>{Number.isFinite(width) ? formatAmount(min) : '0'}</strong>
            <span>
              {b} per {a}
            </span>
          </div>
          <div>
            <small>Current</small>
            <strong>{formatAmount(price)}</strong>
            <span>
              {b} per {a}
            </span>
          </div>
          <div>
            <small>Max price</small>
            <strong>{Number.isFinite(max) ? formatAmount(max) : '∞'}</strong>
            <span>
              {b} per {a}
            </span>
          </div>
        </div>

        <h2 className="panel__title">4 · Deposit</h2>
        <div className="field">
          <div className="field__row">
            <input inputMode="decimal" placeholder="0" value={amountA} onChange={(e) => setAmountA(sanitizeAmount(e.target.value, 8))} aria-label={`${a} to deposit`} />
            <span className="token-static">{a}</span>
          </div>
          <div className="field__foot">{formatUsd(valueA * tokenA.price)}</div>
        </div>
        <div className="field">
          <div className="field__row">
            <input readOnly placeholder="0" value={valueA ? formatAmount(amountB) : ''} aria-label={`${b} to deposit`} />
            <span className="token-static">{b}</span>
          </div>
          <div className="field__foot">{formatUsd(amountB * tokenB.price)}</div>
        </div>
      </section>

      <aside className="panel panel--pad summary" aria-label="Position summary">
        <h2 className="panel__title">Summary</h2>
        <dl className="quote quote--flat">
          <div>
            <dt>Pool</dt>
            <dd>
              {a}/{b} · {FEE_TIERS.find((t) => t.bps === fee)?.label}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{existing ? 'Existing pool' : 'New pool — you set the price'}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>{Number.isFinite(width) ? `${formatPct(-width * 100)} … ${formatPct(width * 100)}` : 'Full range'}</dd>
          </div>
          <div>
            <dt>Deposit value</dt>
            <dd>{formatUsd(depositUsd)}</dd>
          </div>
          <div>
            <dt>Est. fee APR</dt>
            <dd className="up">{estApr.toFixed(1)}%</dd>
          </div>
        </dl>
        <p className="modal__hint">Narrow ranges earn more fees while the price stays inside, and earn nothing once it leaves.</p>
        <button
          type="button"
          className="cta"
          disabled={!valueA || pending}
          onClick={() => submit('Position created', `${formatAmount(valueA)} ${a} + ${formatAmount(amountB)} ${b} in ${a}/${b}.`, () => setAmountA(''))}
        >
          {pending ? 'Confirm in wallet…' : valueA ? 'Create position' : 'Enter an amount'}
        </button>
      </aside>

      <TokenPicker open={picker === 'a'} onClose={() => setPicker(null)} exclude={b} onSelect={(t) => setA(t.symbol)} />
      <TokenPicker open={picker === 'b'} onClose={() => setPicker(null)} exclude={a} onSelect={(t) => setB(t.symbol)} />
    </div>
  );
}
