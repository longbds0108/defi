import { useMemo, useState } from 'react';
import { formatAmount, formatPrice, formatUsd, sanitizeAmount } from '../../lib/format';
import { Segmented, useDemoSubmit } from '../../components/ui';

type Kind = 'dutch' | 'batch' | 'fixed';

const KINDS: Array<{ value: Kind; label: string }> = [
  { value: 'dutch', label: 'Dutch' },
  { value: 'batch', label: 'Batch' },
  { value: 'fixed', label: 'Fixed price' },
];

const KIND_COPY: Record<Kind, string> = {
  dutch: 'Price starts high and decays to the floor. Everyone pays the final clearing price.',
  batch: 'Bids are collected for the whole window, then cleared at a single fair price.',
  fixed: 'First come, first served at one price until the allocation sells out.',
};

function PriceCurve({ kind, start, floor, hours }: { kind: Kind; start: number; floor: number; hours: number }) {
  const width = 600;
  const height = 180;
  const top = Math.max(start, floor) * 1.1 || 1;
  const y = (v: number) => height - 16 - (v / top) * (height - 32);
  const path = useMemo(() => {
    const pts = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      const v = kind === 'fixed' ? start : kind === 'dutch' ? floor + (start - floor) * Math.pow(1 - t, 1.6) : floor + (start - floor) * 0.5;
      return `${i ? 'L' : 'M'}${(t * width).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, start, floor]);

  return (
    <div className="curve">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Auction price over time">
        <line x1="0" x2={width} y1={y(floor)} y2={y(floor)} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        <path d={`${path} L${width},${height} L0,${height} Z`} fill="rgba(155,93,229,0.14)" />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="curve__axis">
        <span>Start</span>
        <span>{kind === 'batch' ? 'Clearing at close' : `Floor ${formatPrice(floor)}`}</span>
        <span>{hours}h</span>
      </div>
    </div>
  );
}

export function LaunchAuction() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('10000000');
  const [allocation, setAllocation] = useState('20');
  const [kind, setKind] = useState<Kind>('dutch');
  const [start, setStart] = useState('0.25');
  const [floor, setFloor] = useState('0.08');
  const [hours, setHours] = useState(48);
  const [seedLiquidity, setSeedLiquidity] = useState(true);
  const { pending, submit } = useDemoSubmit();

  const supplyN = Number(supply) || 0;
  const allocPct = Math.min(100, Number(allocation) || 0);
  const forSale = (supplyN * allocPct) / 100;
  const startN = Number(start) || 0;
  const floorN = kind === 'fixed' ? startN : Number(floor) || 0;
  const minRaise = forSale * floorN;
  const maxRaise = forSale * startN;
  const errors = [
    !name.trim() && 'Token name is required',
    !/^[A-Z0-9]{2,8}$/.test(symbol) && 'Symbol: 2–8 capital letters or digits',
    supplyN <= 0 && 'Total supply must be positive',
    (allocPct <= 0 || allocPct > 80) && 'Sale allocation must be 1–80% of supply',
    kind !== 'fixed' && floorN >= startN && 'Floor price must be below start price',
    startN <= 0 && 'Start price must be positive',
  ].filter(Boolean) as string[];

  return (
    <div className="split">
      <section className="panel panel--pad" aria-label="Auction setup">
        <h2 className="panel__title">Token</h2>
        <div className="form-grid">
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit Finance" />
          </label>
          <label>
            <span>Symbol</span>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="ORB" />
          </label>
          <label>
            <span>Total supply</span>
            <input inputMode="numeric" value={supply} onChange={(e) => setSupply(sanitizeAmount(e.target.value, 0))} />
          </label>
          <label>
            <span>Sold in auction (%)</span>
            <input inputMode="decimal" value={allocation} onChange={(e) => setAllocation(sanitizeAmount(e.target.value, 1))} />
          </label>
        </div>

        <h2 className="panel__title">Auction</h2>
        <Segmented label="Auction type" options={KINDS} value={kind} onChange={setKind} />
        <p className="modal__hint">{KIND_COPY[kind]}</p>
        <div className="form-grid">
          <label>
            <span>{kind === 'fixed' ? 'Price (USDC)' : 'Start price (USDC)'}</span>
            <input inputMode="decimal" value={start} onChange={(e) => setStart(sanitizeAmount(e.target.value, 6))} />
          </label>
          {kind !== 'fixed' && (
            <label>
              <span>{kind === 'batch' ? 'Reserve price (USDC)' : 'Floor price (USDC)'}</span>
              <input inputMode="decimal" value={floor} onChange={(e) => setFloor(sanitizeAmount(e.target.value, 6))} />
            </label>
          )}
          <label className="form-grid__wide">
            <span>Duration · {hours} hours</span>
            <input type="range" min={6} max={168} step={6} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={seedLiquidity} onChange={(e) => setSeedLiquidity(e.target.checked)} />
          <span>
            <strong>Seed a pool after the auction</strong>
            <small>Pairs 20% of proceeds with tokens at the clearing price, so trading opens immediately.</small>
          </span>
        </label>
      </section>

      <aside className="panel panel--pad summary" aria-label="Auction preview">
        <h2 className="panel__title">Preview</h2>
        <PriceCurve kind={kind} start={startN} floor={floorN} hours={hours} />
        <dl className="quote quote--flat">
          <div>
            <dt>Tokens for sale</dt>
            <dd>
              {formatAmount(forSale)} {symbol || 'TOKEN'}
            </dd>
          </div>
          <div>
            <dt>Raise range</dt>
            <dd>{kind === 'fixed' ? formatUsd(maxRaise) : `${formatUsd(minRaise)} – ${formatUsd(maxRaise)}`}</dd>
          </div>
          <div>
            <dt>Implied FDV at start</dt>
            <dd>{formatUsd(supplyN * startN)}</dd>
          </div>
          <div>
            <dt>Protocol fee</dt>
            <dd>1% of proceeds</dd>
          </div>
        </dl>
        {errors.length > 0 && (
          <ul className="form-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="cta"
          disabled={errors.length > 0 || pending}
          onClick={() => submit('Auction scheduled', `${name} (${symbol}) opens with ${formatAmount(forSale)} tokens for ${hours}h.`)}
        >
          {pending ? 'Confirm in wallet…' : 'Launch auction'}
        </button>
      </aside>
    </div>
  );
}
