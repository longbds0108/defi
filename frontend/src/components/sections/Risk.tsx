import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { RISK_PARAMS } from '../../config/site';
import { Kicker } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines } from '../TextScramble';

const EUR_USD = 1.08; // simulated testnet price, labelled in the UI
const MIN_GAUGE_HF = 1;
const MAX_GAUGE_HF = 3;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function statusOf(hf: number) {
  if (hf < 1) return { label: 'Liquidatable', tone: 'danger' } as const;
  if (hf < 1.2) return { label: 'Liquidation risk', tone: 'danger' } as const;
  if (hf < 1.5) return { label: 'Needs attention', tone: 'warning' } as const;
  return { label: 'Healthy', tone: 'safe' } as const;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="slider">
      <div className="slider__top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
      />
    </div>
  );
}

/// Interactive preview using the same formula as the pool:
/// HF = collateralValue × liquidationThreshold / debtValue.
export function Risk() {
  const [collateral, setCollateral] = useState(10_000);
  const [borrowShare, setBorrowShare] = useState(0.55); // share of max borrow
  const [shock, setShock] = useState(0);

  const maxBorrowEur = (collateral * RISK_PARAMS.maxLtv) / EUR_USD;
  const borrowEur = Math.round(maxBorrowEur * borrowShare);
  const price = EUR_USD * (1 + shock);
  const debtUsd = borrowEur * price;
  const hf = debtUsd > 0 ? (collateral * RISK_PARAMS.liquidationThreshold) / debtUsd : Infinity;
  const ltv = debtUsd / collateral;
  const status = Number.isFinite(hf) ? statusOf(hf) : ({ label: 'No active loan', tone: 'neutral' } as const);
  const marker = Number.isFinite(hf) ? Math.min(100, Math.max(0, ((hf - MIN_GAUGE_HF) / (MAX_GAUGE_HF - MIN_GAUGE_HF)) * 100)) : 100;
  // EUR/USD level at which HF reaches 1.00 for this position.
  const liquidationPrice = borrowEur > 0 ? (collateral * RISK_PARAMS.liquidationThreshold) / borrowEur : null;

  return (
    <section className="risk ink" id="risk" data-header-theme="dark">
      <Reveal className="risk__copy">
        <Kicker>RISK, MADE LEGIBLE</Kicker>
        <h2>
          <ScrambleLines lines={['Distance to danger.', { em: 'Not a vague label.' }]} />
        </h2>
        <p>
          Your Health Factor compares risk-adjusted collateral with debt. Below 1.00, part of the position can be
          liquidated. Move the sliders to see how borrowing and price moves change it.
        </p>
        <dl className="param-list">
          <div>
            <dt>Max LTV</dt>
            <dd>{RISK_PARAMS.maxLtv * 100}%</dd>
          </div>
          <div>
            <dt>Liquidation threshold</dt>
            <dd>{+(RISK_PARAMS.liquidationThreshold * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Liquidation bonus</dt>
            <dd>{RISK_PARAMS.liquidationBonus * 100}%</dd>
          </div>
          <div>
            <dt>Close factor</dt>
            <dd>{RISK_PARAMS.closeFactor * 100}%</dd>
          </div>
        </dl>
      </Reveal>

      <Reveal className="risk__panel glass">
        <div className="risk__panel-head">
          <span>Position preview</span>
          <span className="tag">Simulated · EUR/USD {EUR_USD.toFixed(2)} test feed</span>
        </div>

        <Slider
          label="Staked collateral (USDC)"
          value={collateral}
          min={1_000}
          max={50_000}
          step={500}
          display={usd.format(collateral)}
          onChange={setCollateral}
        />
        <Slider
          label="Borrowed (EURC)"
          value={borrowShare}
          min={0}
          max={1}
          step={0.01}
          display={`${eur.format(borrowEur)} · ${Math.round(borrowShare * 100)}% of max`}
          onChange={setBorrowShare}
        />
        <Slider
          label="EUR/USD move"
          value={shock}
          min={-0.2}
          max={0.3}
          step={0.01}
          display={`${shock >= 0 ? '+' : ''}${Math.round(shock * 100)}% → ${price.toFixed(3)}`}
          onChange={setShock}
        />

        <motion.div
          className={`hf hf--${status.tone}`}
          animate={status.tone === 'danger' ? { boxShadow: ['0 0 0 rgba(229,72,77,0)', '0 0 32px rgba(229,72,77,0.22)', '0 0 0 rgba(229,72,77,0)'] } : { boxShadow: '0 0 0 rgba(0,0,0,0)' }}
          transition={status.tone === 'danger' ? { duration: 1.8, repeat: Infinity } : { duration: 0.2 }}
        >
          <div className="hf__top">
            <span>Health Factor</span>
            <span className="hf__status">{status.label}</span>
          </div>
          <div className="hf__value">{Number.isFinite(hf) ? hf.toFixed(2) : '∞'}</div>
          <div
            className="hf__track"
            role="progressbar"
            aria-label="Distance from liquidation threshold"
            aria-valuemin={MIN_GAUGE_HF}
            aria-valuemax={MAX_GAUGE_HF}
            aria-valuenow={Number.isFinite(hf) ? Math.min(MAX_GAUGE_HF, Math.max(MIN_GAUGE_HF, hf)) : MAX_GAUGE_HF}
          >
            <motion.span className="hf__marker" animate={{ left: `${marker}%` }} transition={{ duration: 0.35, ease: 'easeOut' }} />
          </div>
          <div className="hf__scale" aria-hidden="true">
            <span>1.00 · Liquidation</span>
            <span>1.50</span>
            <span>3.00+ · Healthy</span>
          </div>
        </motion.div>

        <dl className="risk__stats">
          <div>
            <dt>Debt value</dt>
            <dd>{usd.format(debtUsd)}</dd>
          </div>
          <div>
            <dt>Current LTV</dt>
            <dd>{(ltv * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Liquidation at EUR/USD</dt>
            <dd>{liquidationPrice ? liquidationPrice.toFixed(3) : '—'}</dd>
          </div>
        </dl>
      </Reveal>
    </section>
  );
}
